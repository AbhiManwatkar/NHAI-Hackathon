import { AppState, AppStateStatus } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import BackgroundFetch from 'react-native-background-fetch';
import { SyncQueue } from './SyncQueue';
import { AWSUploader, SyncSummary } from './AWSUploader';
import { PurgeManager } from './PurgeManager';

export type SyncReason = 'CONNECTIVITY_RESTORED' | 'BACKGROUND_FETCH' | 'MANUAL' | 'APP_FOREGROUND';

export interface SyncResult {
  successCount: number;
  failedCount: number;
}

export class SyncManager {
  private static instance: SyncManager | null = null;
  
  private queue = new SyncQueue();
  private uploader = new AWSUploader();
  private purgeManager = new PurgeManager();
  
  private isSyncing = false;
  private lastSyncTime: Date | null = null;

  private constructor() {}

  static getInstance(): SyncManager {
    if (!SyncManager.instance) {
      SyncManager.instance = new SyncManager();
    }
    return SyncManager.instance;
  }

  init(): void {
    // 1. Listen for connectivity restores
    NetInfo.addEventListener(state => {
      if (state.isConnected) {
        this.triggerSync('CONNECTIVITY_RESTORED');
      }
    });

    // 2. Configure periodic background fetch (15 mins)
    BackgroundFetch.configure({
      minimumFetchInterval: 15,
      stopOnTerminate: false,
      enableHeadless: true,
      startOnBoot: true,
    }, async (taskId) => {
      console.log('[SyncManager] BackgroundFetch executing');
      await this.triggerSync('BACKGROUND_FETCH');
      BackgroundFetch.finish(taskId);
    }, (error) => {
      console.warn('[SyncManager] BackgroundFetch failed to configure:', error);
    });

    // 3. Listen for app foreground events
    AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active') {
        this.triggerSync('APP_FOREGROUND');
      }
    });
  }

  async triggerSync(reason: SyncReason): Promise<SyncResult> {
    if (this.isSyncing) {
      return { successCount: 0, failedCount: 0 };
    }

    this.isSyncing = true;
    const startTime = Date.now();

    try {
      // Step 1: Check AWS connectivity
      const online = await this.uploader.testConnectivity();
      if (!online) {
        this.isSyncing = false;
        return { successCount: 0, failedCount: 0 };
      }

      // Step 2: Retrieve unsynced records batch (up to 50 logs)
      const batch = await this.queue.getUnsyncedBatch(50);
      if (batch.length === 0) {
        this.isSyncing = false;
        return { successCount: 0, failedCount: 0 };
      }

      const ids = batch.map(r => r.id);

      // Step 3: Mark batch as syncing
      await this.queue.markBatchSyncing(ids);

      // Step 4: Upload chunk to AWS DynamoDB
      const uploadRes = await this.uploader.uploadBatch(batch);

      // Step 5 & 6: Set database status according to result
      await this.queue.markBatchSynced(uploadRes.success);
      await this.queue.markBatchFailed(uploadRes.failed);

      // Step 7: Scrub personal records (zero-filling GPS/confidence/liveness metrics)
      await this.purgeManager.purgeAfterSync(uploadRes.success);

      // Step 8: S3 Sync Summary Audit Upload
      const duration = Date.now() - startTime;
      const summary: SyncSummary = {
        recordCount: uploadRes.success.length,
        siteCode: 'SITE_NHAI_01',
        deviceId: 'MOBILE_DEV_01',
        syncDuration: duration,
      };
      await this.uploader.uploadAuditLog(summary);

      this.lastSyncTime = new Date();
      this.isSyncing = false;
      return {
        successCount: uploadRes.success.length,
        failedCount: uploadRes.failed.length,
      };

    } catch (err) {
      console.error('[SyncManager] Trigger sync error:', err);
      // Reset stuck syncing logs to LOCAL so they don't lock
      const batch = await this.queue.getUnsyncedBatch(50);
      const ids = batch.map(r => r.id);
      await this.queue.markBatchFailed(ids);
      this.isSyncing = false;
      return { successCount: 0, failedCount: ids.length };
    }
  }

  async forceSyncAll(): Promise<SyncResult> {
    return this.triggerSync('MANUAL');
  }

  getIsSyncing(): boolean {
    return this.isSyncing;
  }

  getLastSyncTime(): Date | null {
    return this.lastSyncTime;
  }
}

export * from './SyncQueue';
export * from './AWSUploader';
export * from './PurgeManager';
