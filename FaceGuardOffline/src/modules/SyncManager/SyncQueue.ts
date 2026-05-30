/**
 * @fileoverview Priority queue manager for offline sync operations.
 * Manages the ordered processing of pending sync operations with
 * priority-based scheduling (attendance > embeddings > personnel > logs).
 *
 * Integrates with the SQLite sync_queue table for persistent storage
 * and crash resilience.
 *
 * @module SyncManager/SyncQueue
 * @version 1.0.0
 */

import { Logger } from '../../utils/logger';

const TAG = 'SyncQueue';

// ─── Types ───────────────────────────────────────────────────────────────────

/**
 * Priority levels for sync operations.
 * Lower number = higher priority.
 */
export enum SyncPriority {
  /** Attendance records - highest priority, time-sensitive */
  CRITICAL = 1,
  /** Face embeddings - high priority, security-relevant */
  HIGH = 2,
  /** Personnel records - medium priority */
  MEDIUM = 3,
  /** Application logs and metadata - lowest priority */
  LOW = 4,
}

/**
 * Type of database operation to sync.
 */
export type SyncOperation = 'INSERT' | 'UPDATE' | 'DELETE';

/**
 * Status of a sync queue item.
 */
export type SyncItemStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';

/**
 * Represents a single item in the sync queue.
 */
export interface SyncQueueItem {
  /** Unique identifier for this queue item */
  id: string;
  /** Source table name */
  tableName: string;
  /** ID of the record in the source table */
  recordId: string;
  /** Type of operation */
  operation: SyncOperation;
  /** Priority level */
  priority: SyncPriority;
  /** JSON payload containing the data to sync */
  payload: string | null;
  /** Number of sync attempts */
  retryCount: number;
  /** Maximum retry attempts */
  maxRetries: number;
  /** Last error message */
  lastError: string | null;
  /** Current status */
  status: SyncItemStatus;
  /** When the item was created (ISO 8601) */
  createdAt: string;
  /** When the last sync attempt was made (ISO 8601 or null) */
  lastAttemptAt: string | null;
  /** When the item was successfully synced (ISO 8601 or null) */
  syncedAt: string | null;
}

/**
 * Options for enqueuing a sync operation.
 */
export interface EnqueueOptions {
  /** Source table name */
  tableName: string;
  /** Record ID in the source table */
  recordId: string;
  /** Type of operation */
  operation: SyncOperation;
  /** Priority level. Default: MEDIUM */
  priority?: SyncPriority;
  /** JSON payload for the sync data */
  payload?: Record<string, unknown>;
  /** Maximum retries before marking as failed. Default: 5 */
  maxRetries?: number;
}

/**
 * Statistics about the sync queue.
 */
export interface QueueStats {
  /** Total items in the queue (all statuses) */
  totalItems: number;
  /** Items pending sync */
  pendingItems: number;
  /** Items currently being synced */
  inProgressItems: number;
  /** Successfully synced items (awaiting purge) */
  completedItems: number;
  /** Failed items that exceeded max retries */
  failedItems: number;
  /** Breakdown by priority */
  byPriority: Record<SyncPriority, number>;
  /** Breakdown by table */
  byTable: Record<string, number>;
  /** Oldest pending item age in seconds */
  oldestPendingAgeSecs: number;
}

/**
 * Interface for the database adapter used by SyncQueue.
 * This abstracts the actual SQLite implementation for testability.
 */
export interface SyncQueueDBAdapter {
  executeSql(sql: string, params?: unknown[]): Promise<{ rows: unknown[] }>;
}

/**
 * Priority queue manager for offline sync operations.
 *
 * Manages a persistent priority queue backed by SQLite for tracking
 * offline operations that need to be synced to the cloud. Operations
 * are processed in priority order with automatic retry and failure handling.
 *
 * @example
 * ```typescript
 * const queue = new SyncQueue(dbAdapter);
 * await queue.initialize();
 *
 * // Enqueue an attendance record for sync
 * await queue.enqueue({
 *   tableName: 'attendance_log',
 *   recordId: 'att-123',
 *   operation: 'INSERT',
 *   priority: SyncPriority.CRITICAL,
 *   payload: { personnelId: 'p-456', timestamp: '...' },
 * });
 *
 * // Get next item to sync
 * const item = await queue.dequeue();
 * if (item) {
 *   try {
 *     await syncToCloud(item);
 *     await queue.markCompleted(item.id);
 *   } catch (error) {
 *     await queue.markFailed(item.id, error.message);
 *   }
 * }
 * ```
 */
export class SyncQueue {
  private readonly db: SyncQueueDBAdapter;
  private initialized = false;

  constructor(dbAdapter: SyncQueueDBAdapter) {
    this.db = dbAdapter;
  }

  /**
   * Initializes the sync queue.
   * Resets any items stuck in IN_PROGRESS state (from app crashes).
   */
  async initialize(): Promise<void> {
    Logger.info(TAG, 'Initializing sync queue...');

    try {
      // Reset any items stuck in IN_PROGRESS (from crash recovery)
      await this.db.executeSql(
        "UPDATE sync_queue SET status = 'PENDING' WHERE status = 'IN_PROGRESS'",
      );

      const stats = await this.getQueueStats();
      Logger.info(
        TAG,
        `Sync queue initialized. Pending: ${stats.pendingItems}, ` +
          `Failed: ${stats.failedItems}, Total: ${stats.totalItems}`,
      );

      this.initialized = true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      Logger.error(TAG, `Failed to initialize sync queue: ${errorMessage}`);
      throw new Error(`SyncQueue initialization failed: ${errorMessage}`);
    }
  }

  /**
   * Enqueues a new sync operation into the priority queue.
   *
   * If a pending operation already exists for the same table+record+operation,
   * it will be updated rather than duplicated.
   *
   * @param options - The operation to enqueue.
   * @returns The ID of the enqueued item.
   */
  async enqueue(options: EnqueueOptions): Promise<string> {
    this.ensureInitialized();

    const {
      tableName,
      recordId,
      operation,
      priority = SyncPriority.MEDIUM,
      payload = null,
      maxRetries = 5,
    } = options;

    try {
      // Check for existing pending operation for same record
      const existing = await this.db.executeSql(
        `SELECT id FROM sync_queue
         WHERE table_name = ? AND record_id = ? AND operation = ? AND status = 'PENDING'
         LIMIT 1`,
        [tableName, recordId, operation],
      );

      if (existing.rows.length > 0) {
        // Update existing pending operation
        const existingId = (existing.rows[0] as { id: string }).id;
        await this.db.executeSql(
          `UPDATE sync_queue
           SET payload = ?, priority = ?, max_retries = ?, created_at = datetime('now')
           WHERE id = ?`,
          [payload ? JSON.stringify(payload) : null, priority, maxRetries, existingId],
        );

        Logger.debug(TAG, `Updated existing queue item: ${existingId} (${tableName}.${recordId})`);
        return existingId;
      }

      // Generate UUID for new queue item
      const id = this.generateUUID();

      await this.db.executeSql(
        `INSERT INTO sync_queue
         (id, table_name, record_id, operation, priority, payload, max_retries, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'PENDING', datetime('now'))`,
        [
          id,
          tableName,
          recordId,
          operation,
          priority,
          payload ? JSON.stringify(payload) : null,
          maxRetries,
        ],
      );

      Logger.debug(
        TAG,
        `Enqueued: ${id} (${tableName}.${recordId} ${operation}, priority=${priority})`,
      );

      return id;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      Logger.error(TAG, `Failed to enqueue operation: ${errorMessage}`);
      throw new Error(`Enqueue failed: ${errorMessage}`);
    }
  }

  /**
   * Dequeues the highest-priority pending item from the queue.
   * Marks the item as IN_PROGRESS atomically.
   *
   * @returns The next item to process, or null if queue is empty.
   */
  async dequeue(): Promise<SyncQueueItem | null> {
    this.ensureInitialized();

    try {
      // Select highest priority, oldest pending item
      const result = await this.db.executeSql(
        `SELECT * FROM sync_queue
         WHERE status = 'PENDING' AND retry_count < max_retries
         ORDER BY priority ASC, created_at ASC
         LIMIT 1`,
      );

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0] as Record<string, unknown>;
      const item = this.rowToSyncItem(row);

      // Mark as IN_PROGRESS
      await this.db.executeSql(
        `UPDATE sync_queue
         SET status = 'IN_PROGRESS', last_attempt_at = datetime('now')
         WHERE id = ?`,
        [item.id],
      );

      Logger.debug(TAG, `Dequeued: ${item.id} (${item.tableName}.${item.recordId})`);

      return { ...item, status: 'IN_PROGRESS' };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      Logger.error(TAG, `Failed to dequeue: ${errorMessage}`);
      throw new Error(`Dequeue failed: ${errorMessage}`);
    }
  }

  /**
   * Peeks at the highest-priority pending item without removing it.
   *
   * @returns The next item that would be dequeued, or null if empty.
   */
  async peek(): Promise<SyncQueueItem | null> {
    this.ensureInitialized();

    try {
      const result = await this.db.executeSql(
        `SELECT * FROM sync_queue
         WHERE status = 'PENDING' AND retry_count < max_retries
         ORDER BY priority ASC, created_at ASC
         LIMIT 1`,
      );

      if (result.rows.length === 0) {
        return null;
      }

      return this.rowToSyncItem(result.rows[0] as Record<string, unknown>);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      Logger.error(TAG, `Failed to peek: ${errorMessage}`);
      throw new Error(`Peek failed: ${errorMessage}`);
    }
  }

  /**
   * Dequeues a batch of items for bulk processing.
   *
   * @param batchSize - Maximum number of items to dequeue. Default: 10.
   * @param priority - Optional: only dequeue items of this priority.
   * @returns Array of items marked as IN_PROGRESS.
   */
  async dequeueBatch(batchSize: number = 10, priority?: SyncPriority): Promise<SyncQueueItem[]> {
    this.ensureInitialized();

    try {
      let query = `SELECT * FROM sync_queue
                    WHERE status = 'PENDING' AND retry_count < max_retries`;
      const params: unknown[] = [];

      if (priority !== undefined) {
        query += ' AND priority = ?';
        params.push(priority);
      }

      query += ' ORDER BY priority ASC, created_at ASC LIMIT ?';
      params.push(batchSize);

      const result = await this.db.executeSql(query, params);

      if (result.rows.length === 0) {
        return [];
      }

      const items: SyncQueueItem[] = [];
      const ids: string[] = [];

      for (const row of result.rows) {
        const item = this.rowToSyncItem(row as Record<string, unknown>);
        items.push({ ...item, status: 'IN_PROGRESS' });
        ids.push(item.id);
      }

      // Batch update status to IN_PROGRESS
      const placeholders = ids.map(() => '?').join(',');
      await this.db.executeSql(
        `UPDATE sync_queue
         SET status = 'IN_PROGRESS', last_attempt_at = datetime('now')
         WHERE id IN (${placeholders})`,
        ids,
      );

      Logger.debug(TAG, `Batch dequeued ${items.length} items`);
      return items;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      Logger.error(TAG, `Failed to batch dequeue: ${errorMessage}`);
      throw new Error(`Batch dequeue failed: ${errorMessage}`);
    }
  }

  /**
   * Marks a queue item as successfully completed.
   *
   * @param itemId - The ID of the completed item.
   */
  async markCompleted(itemId: string): Promise<void> {
    this.ensureInitialized();

    try {
      await this.db.executeSql(
        `UPDATE sync_queue
         SET status = 'COMPLETED', synced_at = datetime('now')
         WHERE id = ?`,
        [itemId],
      );

      Logger.debug(TAG, `Marked completed: ${itemId}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      Logger.error(TAG, `Failed to mark completed: ${errorMessage}`);
      throw new Error(`Mark completed failed: ${errorMessage}`);
    }
  }

  /**
   * Marks a batch of queue items as completed.
   *
   * @param itemIds - Array of completed item IDs.
   */
  async markBatchCompleted(itemIds: string[]): Promise<void> {
    this.ensureInitialized();

    if (itemIds.length === 0) {
      return;
    }

    try {
      const placeholders = itemIds.map(() => '?').join(',');
      await this.db.executeSql(
        `UPDATE sync_queue
         SET status = 'COMPLETED', synced_at = datetime('now')
         WHERE id IN (${placeholders})`,
        itemIds,
      );

      Logger.debug(TAG, `Batch marked completed: ${itemIds.length} items`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      Logger.error(TAG, `Failed to batch mark completed: ${errorMessage}`);
      throw new Error(`Batch mark completed failed: ${errorMessage}`);
    }
  }

  /**
   * Marks a queue item as failed and increments the retry counter.
   * If max retries are exceeded, the item is permanently marked as FAILED.
   *
   * @param itemId - The ID of the failed item.
   * @param errorMessage - Description of the failure.
   */
  async markFailed(itemId: string, errorMessage: string): Promise<void> {
    this.ensureInitialized();

    try {
      // Increment retry count and check if max retries exceeded
      await this.db.executeSql(
        `UPDATE sync_queue
         SET retry_count = retry_count + 1,
             last_error = ?,
             last_attempt_at = datetime('now'),
             status = CASE
               WHEN retry_count + 1 >= max_retries THEN 'FAILED'
               ELSE 'PENDING'
             END
         WHERE id = ?`,
        [errorMessage, itemId],
      );

      Logger.warn(TAG, `Marked failed: ${itemId} - ${errorMessage}`);
    } catch (error) {
      const err = error instanceof Error ? error.message : 'Unknown error';
      Logger.error(TAG, `Failed to mark failed: ${err}`);
      throw new Error(`Mark failed error: ${err}`);
    }
  }

  /**
   * Returns the total number of pending items in the queue.
   */
  async getQueueSize(): Promise<number> {
    this.ensureInitialized();

    try {
      const result = await this.db.executeSql(
        "SELECT COUNT(*) as count FROM sync_queue WHERE status = 'PENDING'",
      );

      return (result.rows[0] as { count: number }).count;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      Logger.error(TAG, `Failed to get queue size: ${errorMessage}`);
      return 0;
    }
  }

  /**
   * Returns the oldest pending item in the queue.
   *
   * @returns The oldest pending item, or null if queue is empty.
   */
  async getOldestItem(): Promise<SyncQueueItem | null> {
    this.ensureInitialized();

    try {
      const result = await this.db.executeSql(
        `SELECT * FROM sync_queue
         WHERE status = 'PENDING'
         ORDER BY created_at ASC
         LIMIT 1`,
      );

      if (result.rows.length === 0) {
        return null;
      }

      return this.rowToSyncItem(result.rows[0] as Record<string, unknown>);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      Logger.error(TAG, `Failed to get oldest item: ${errorMessage}`);
      return null;
    }
  }

  /**
   * Returns comprehensive statistics about the sync queue.
   */
  async getQueueStats(): Promise<QueueStats> {
    this.ensureInitialized();

    try {
      // Total counts by status
      const statusResult = await this.db.executeSql(
        'SELECT status, COUNT(*) as count FROM sync_queue GROUP BY status',
      );

      // Counts by priority (pending only)
      const priorityResult = await this.db.executeSql(
        `SELECT priority, COUNT(*) as count FROM sync_queue
         WHERE status = 'PENDING' GROUP BY priority`,
      );

      // Counts by table (pending only)
      const tableResult = await this.db.executeSql(
        `SELECT table_name, COUNT(*) as count FROM sync_queue
         WHERE status = 'PENDING' GROUP BY table_name`,
      );

      // Oldest pending item age
      const oldestResult = await this.db.executeSql(
        "SELECT MIN(created_at) as oldest FROM sync_queue WHERE status = 'PENDING'",
      );

      // Parse status counts
      const statusCounts: Record<string, number> = {};
      for (const row of statusResult.rows) {
        const r = row as { status: string; count: number };
        statusCounts[r.status] = r.count;
      }

      // Parse priority counts
      const byPriority: Record<SyncPriority, number> = {
        [SyncPriority.CRITICAL]: 0,
        [SyncPriority.HIGH]: 0,
        [SyncPriority.MEDIUM]: 0,
        [SyncPriority.LOW]: 0,
      };
      for (const row of priorityResult.rows) {
        const r = row as { priority: number; count: number };
        byPriority[r.priority as SyncPriority] = r.count;
      }

      // Parse table counts
      const byTable: Record<string, number> = {};
      for (const row of tableResult.rows) {
        const r = row as { table_name: string; count: number };
        byTable[r.table_name] = r.count;
      }

      // Calculate oldest pending age
      let oldestPendingAgeSecs = 0;
      if (oldestResult.rows.length > 0) {
        const oldest = (oldestResult.rows[0] as { oldest: string | null }).oldest;
        if (oldest) {
          oldestPendingAgeSecs = Math.floor((Date.now() - new Date(oldest).getTime()) / 1000);
        }
      }

      return {
        totalItems: Object.values(statusCounts).reduce((a, b) => a + b, 0),
        pendingItems: statusCounts.PENDING || 0,
        inProgressItems: statusCounts.IN_PROGRESS || 0,
        completedItems: statusCounts.COMPLETED || 0,
        failedItems: statusCounts.FAILED || 0,
        byPriority,
        byTable,
        oldestPendingAgeSecs,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      Logger.error(TAG, `Failed to get queue stats: ${errorMessage}`);
      return {
        totalItems: 0,
        pendingItems: 0,
        inProgressItems: 0,
        completedItems: 0,
        failedItems: 0,
        byPriority: {
          [SyncPriority.CRITICAL]: 0,
          [SyncPriority.HIGH]: 0,
          [SyncPriority.MEDIUM]: 0,
          [SyncPriority.LOW]: 0,
        },
        byTable: {},
        oldestPendingAgeSecs: 0,
      };
    }
  }

  /**
   * Removes completed items that have been synced and are older than
   * the specified retention period.
   *
   * @param retentionDays - Days to keep completed items. Default: 7.
   * @returns Number of items purged.
   */
  async purgeCompleted(retentionDays: number = 7): Promise<number> {
    this.ensureInitialized();

    try {
      const result = await this.db.executeSql(
        `DELETE FROM sync_queue
         WHERE status = 'COMPLETED'
         AND synced_at < datetime('now', '-' || ? || ' days')`,
        [retentionDays],
      );

      const purgedCount = (result as unknown as { rowsAffected?: number }).rowsAffected || 0;

      if (purgedCount > 0) {
        Logger.info(TAG, `Purged ${purgedCount} completed queue items`);
      }

      return purgedCount;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      Logger.error(TAG, `Failed to purge completed items: ${errorMessage}`);
      return 0;
    }
  }

  /**
   * Retries all failed items by resetting their status to PENDING
   * and zeroing the retry counter.
   *
   * @returns Number of items reset for retry.
   */
  async retryAllFailed(): Promise<number> {
    this.ensureInitialized();

    try {
      const result = await this.db.executeSql(
        `UPDATE sync_queue
         SET status = 'PENDING', retry_count = 0, last_error = NULL
         WHERE status = 'FAILED'`,
      );

      const resetCount = (result as unknown as { rowsAffected?: number }).rowsAffected || 0;

      if (resetCount > 0) {
        Logger.info(TAG, `Reset ${resetCount} failed items for retry`);
      }

      return resetCount;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      Logger.error(TAG, `Failed to retry failed items: ${errorMessage}`);
      return 0;
    }
  }

  // ─── Private Helpers ───────────────────────────────────────────────────────

  /**
   * Ensures the queue has been initialized.
   */
  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error('SyncQueue is not initialized. Call initialize() first.');
    }
  }

  /**
   * Converts a database row to a SyncQueueItem.
   */
  private rowToSyncItem(row: Record<string, unknown>): SyncQueueItem {
    return {
      id: row.id as string,
      tableName: row.table_name as string,
      recordId: row.record_id as string,
      operation: row.operation as SyncOperation,
      priority: row.priority as SyncPriority,
      payload: row.payload as string | null,
      retryCount: row.retry_count as number,
      maxRetries: row.max_retries as number,
      lastError: row.last_error as string | null,
      status: row.status as SyncItemStatus,
      createdAt: row.created_at as string,
      lastAttemptAt: row.last_attempt_at as string | null,
      syncedAt: row.synced_at as string | null,
    };
  }

  /**
   * Generates a UUID v4 string.
   */
  private generateUUID(): string {
    const hex = '0123456789abcdef';
    let uuid = '';

    for (let i = 0; i < 36; i++) {
      if (i === 8 || i === 13 || i === 18 || i === 23) {
        uuid += '-';
      } else if (i === 14) {
        uuid += '4'; // Version 4
      } else if (i === 19) {
        uuid += hex[Math.floor(Math.random() * 4) + 8]; // Variant bits
      } else {
        uuid += hex[Math.floor(Math.random() * 16)];
      }
    }

    return uuid;
  }
}
