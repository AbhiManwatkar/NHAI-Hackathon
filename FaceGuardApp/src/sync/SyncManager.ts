/**
 * FaceGuard Offline – SyncManager
 * =================================
 *
 * Manages the offline-first sync lifecycle:
 *   1. DETECT  — NetInfo listener detects connectivity restoration
 *   2. QUEUE   — Read LOCAL records from BiometricVault
 *   3. UPLOAD  — Batch upload to DynamoDB (max 25 per BatchWrite)
 *   4. VERIFY  — Handle partial failures, retry with exponential backoff
 *   5. PURGE   — Cryptographic purge only after ALL records confirmed
 *
 * Background sync runs via react-native-background-fetch every 15 min.
 * Manual sync is also available via SyncManager.uploadBatch().
 */

import type { BiometricVault } from '../storage/BiometricVault';
import type { SyncSummary, SyncableRecord } from '../types';

// ── AWS SDK (conditionally imported) ─────────────────────────────────

let DynamoDBClient: any;
try {
  const AWS = require('aws-sdk');
  DynamoDBClient = AWS.DynamoDB.DocumentClient;
} catch {
  // AWS SDK not available — will fail gracefully when uploadBatch is called
}

// ── Constants ────────────────────────────────────────────────────────

/** DynamoDB BatchWrite item limit */
const DYNAMO_BATCH_SIZE = 25;

/** Maximum retry attempts for unprocessed items */
const MAX_RETRIES = 3;

/** Base delay for exponential backoff (ms) */
const BASE_RETRY_DELAY_MS = 200;

/** DynamoDB table name */
const TABLE_NAME = 'FaceGuardAttendance';

/** Background fetch minimum interval (minutes) */
const DEFAULT_FETCH_INTERVAL = 15;

// ── SyncManager Class ────────────────────────────────────────────────

export class SyncManager {
  private vault: BiometricVault;
  private dynamoClient: any;
  private syncListeners: Array<(summary: SyncSummary) => void> = [];
  /** Track employee IDs that were successfully synced in the last batch */
  private lastSyncedEmployeeIds: Set<string> = new Set();

  constructor(vault: BiometricVault, awsConfig?: any) {
    this.vault = vault;

    if (DynamoDBClient && awsConfig) {
      this.dynamoClient = new DynamoDBClient({
        region: awsConfig.region,
        credentials: awsConfig.credentials,
      });
    } else if (DynamoDBClient) {
      this.dynamoClient = new DynamoDBClient();
    }
  }

  // ── Queue Management ─────────────────────────────────────────────

  /**
   * Get the number of records pending sync.
   */
  async getQueueSize(): Promise<number> {
    const records = await this.vault.getUnsyncedRecords();
    return records.length;
  }

  // ── Upload ───────────────────────────────────────────────────────

  /**
   * Upload all pending LOCAL records to DynamoDB in batches of 25.
   *
   * DynamoDB BatchWrite has a limit of 25 items per call. For sites with
   * many queued records (e.g., after days offline), this method splits
   * records into chunks and processes them sequentially.
   *
   * Partial failures: If DynamoDB returns UnprocessedItems, only the
   * successfully written items are marked as SYNCED. Failed items remain
   * LOCAL and will be retried on the next sync cycle.
   *
   * @throws On complete network failure (no records synced)
   */
  async uploadBatch(): Promise<void> {
    const records = await this.vault.getUnsyncedRecords();
    if (records.length === 0) return;

    // Track synced employee IDs for purge
    this.lastSyncedEmployeeIds.clear();

    // Split into chunks of DYNAMO_BATCH_SIZE
    const chunks = this._chunkArray(records, DYNAMO_BATCH_SIZE);

    for (const chunk of chunks) {
      await this._uploadChunk(chunk);
    }
  }

  /**
   * Upload a single chunk of records with retry logic.
   *
   * On each iteration, we build PutRequest items from the remaining
   * unprocessed records. After DynamoDB responds, we determine which
   * items succeeded and mark them as SYNCED. Unprocessed items are
   * retried with exponential backoff up to MAX_RETRIES times.
   */
  private async _uploadChunk(records: SyncableRecord[]): Promise<void> {
    // Build a map from recordId → record for lookup
    const recordMap = new Map<string, SyncableRecord>();
    for (const r of records) {
      recordMap.set(r.id, r);
    }

    // Start with all record IDs pending
    let pendingIds = records.map((r) => r.id);
    let retries = 0;

    while (pendingIds.length > 0 && retries <= MAX_RETRIES) {
      // Build DynamoDB PutRequest items from pending IDs
      const items = pendingIds.map((id) => {
        const r = recordMap.get(id)!;
        return {
          PutRequest: {
            Item: {
              recordId: r.id,
              employeeId: r.employeeId,
              timestamp: r.timestamp,
              type: r.type,
              confidence: r.confidence,
              livenessScore: r.livenessScore,
            },
          },
        };
      });

      const params = {
        RequestItems: {
          [TABLE_NAME]: items,
        },
      };

      const result = await this.dynamoClient
        .batchWrite(params)
        .promise();

      // Determine which items were NOT processed
      const unprocessed =
        result.UnprocessedItems?.[TABLE_NAME] ?? [];
      const unprocessedIds = new Set<string>(
        unprocessed.map((u: any) => u.PutRequest.Item.recordId),
      );

      // Mark successfully uploaded records as SYNCED
      const syncedIds = pendingIds.filter((id) => !unprocessedIds.has(id));

      if (syncedIds.length > 0) {
        await this.vault.markSynced(syncedIds);

        // Track employee IDs for purge
        for (const id of syncedIds) {
          const record = recordMap.get(id);
          if (record) {
            this.lastSyncedEmployeeIds.add(record.employeeId);
          }
        }
      }

      if (unprocessed.length === 0) {
        // All items in this chunk processed successfully
        break;
      }

      // Retry only unprocessed items
      pendingIds = Array.from(unprocessedIds) as string[];
      retries++;

      if (retries <= MAX_RETRIES) {
        const delay = BASE_RETRY_DELAY_MS * Math.pow(2, retries);
        await this._sleep(delay);
      }
    }
  }

  // ── Sync and Purge ───────────────────────────────────────────────

  /**
   * Full sync cycle: upload → verify → purge.
   *
   * Purge ONLY occurs when ALL records are successfully synced.
   * This ensures no biometric data is deleted before cloud confirmation.
   *
   * Flow:
   *   1. Upload all LOCAL records to DynamoDB
   *   2. Check if any records remain unsynced
   *   3. If all synced → trigger cryptographic purge
   *   4. If any remain LOCAL → skip purge (will retry next cycle)
   */
  async syncAndPurge(): Promise<void> {
    // Step 1: Upload
    await this.uploadBatch();

    // Step 2: Verify all records are synced
    const remaining = await this.vault.getUnsyncedRecords();
    if (remaining.length > 0) {
      // Some records still unsynced — do NOT purge
      return;
    }

    // Step 3: All synced — trigger purge for all employees that were synced
    for (const empId of this.lastSyncedEmployeeIds) {
      await this.vault.purgeRecords(empId);
    }
  }

  // ── Event Listeners ──────────────────────────────────────────────

  /**
   * Register a callback for sync completion events.
   *
   * @param callback - Called with sync summary after each sync attempt
   * @returns Unsubscribe function
   */
  onSyncComplete(callback: (summary: SyncSummary) => void): () => void {
    this.syncListeners.push(callback);
    return () => {
      this.syncListeners = this.syncListeners.filter((l) => l !== callback);
    };
  }

  /**
   * Notify all registered sync listeners.
   */
  private _notifySyncComplete(summary: SyncSummary): void {
    for (const listener of this.syncListeners) {
      try {
        listener(summary);
      } catch (err) {
        console.warn('SyncManager: listener error:', err);
      }
    }
  }

  // ── Background Fetch ─────────────────────────────────────────────

  /**
   * Handler for react-native-background-fetch events.
   *
   * Called by the OS when a background fetch slot is available.
   * Only triggers sync when the device is online.
   *
   * @param context - { isOnline: boolean }
   */
  async onBackgroundFetch(context: { isOnline: boolean }): Promise<void> {
    if (!context.isOnline) {
      return;
    }

    try {
      await this.uploadBatch();
    } catch (err) {
      console.warn('SyncManager: background fetch upload failed:', err);
    }
  }

  /**
   * Register the background fetch handler with the OS.
   *
   * Configures react-native-background-fetch to trigger sync
   * every 15 minutes. The OS may adjust timing based on device
   * usage patterns and battery state.
   */
  registerBackgroundSync(intervalMinutes: number = DEFAULT_FETCH_INTERVAL): void {
    let BgFetch: any;
    try {
      BgFetch = require('react-native-background-fetch');
    } catch {
      console.warn('SyncManager: react-native-background-fetch not available');
      return;
    }

    BgFetch.configure(
      {
        minimumFetchInterval: intervalMinutes,
        stopOnTerminate: false,
        startOnBoot: true,
        enableHeadless: true,
      },
      async (taskId: string) => {
        try {
          await this.onBackgroundFetch({ isOnline: true });
        } catch (err) {
          console.warn('SyncManager: background task failed:', err);
        } finally {
          BgFetch.finish(taskId);
        }
      },
      (taskId: string) => {
        // Task timeout handler
        console.warn('SyncManager: background task timed out:', taskId);
        BgFetch.finish(taskId);
      },
    );
  }

  // ── NetInfo Integration ──────────────────────────────────────────

  /**
   * Start listening for network connectivity changes.
   *
   * When connectivity is restored, automatically triggers a sync.
   * Uses @react-native-community/netinfo.
   */
  startNetworkListener(): () => void {
    let NetInfo: any;
    try {
      NetInfo = require('@react-native-community/netinfo').default;
    } catch {
      console.warn('SyncManager: NetInfo not available');
      return () => {};
    }

    const unsubscribe = NetInfo.addEventListener((state: any) => {
      if (state.isConnected && state.isInternetReachable) {
        // Network restored — trigger sync
        this.uploadBatch().catch((err) => {
          console.warn('SyncManager: auto-sync failed:', err);
        });
      }
    });

    return unsubscribe;
  }

  // ── Manual Sync ──────────────────────────────────────────────────

  /**
   * Manually trigger a full sync and return summary.
   *
   * Used by the SDK's `FaceGuard.syncNow()` method and the admin UI.
   *
   * @returns Sync summary with counts of uploaded, failed, and remaining records
   */
  async syncNow(): Promise<SyncSummary> {
    const beforeCount = await this.getQueueSize();

    try {
      await this.uploadBatch();
    } catch (err) {
      // Total failure
      const summary: SyncSummary = {
        uploaded: 0,
        failed: beforeCount,
        remaining: beforeCount,
      };
      this._notifySyncComplete(summary);
      throw err;
    }

    const afterCount = await this.getQueueSize();
    const uploaded = beforeCount - afterCount;

    const summary: SyncSummary = {
      uploaded,
      failed: afterCount,
      remaining: afterCount,
    };

    this._notifySyncComplete(summary);
    return summary;
  }

  // ── Internal Helpers ─────────────────────────────────────────────

  /**
   * Split an array into chunks of the given size.
   */
  private _chunkArray<T>(arr: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < arr.length; i += size) {
      chunks.push(arr.slice(i, i + size));
    }
    return chunks;
  }

  /**
   * Sleep for a given number of milliseconds.
   */
  private _sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
