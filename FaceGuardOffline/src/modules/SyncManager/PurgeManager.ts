/**
 * @fileoverview Data lifecycle management for FaceGuard Offline.
 * Handles automatic purging of synced records that exceed the
 * maximum offline retention period (MAX_OFFLINE_DAYS).
 *
 * Designed to run on background-fetch schedules to maintain
 * device storage health without impacting foreground performance.
 *
 * @module SyncManager/PurgeManager
 * @version 1.0.0
 */

import { Logger } from '../../utils/logger';

const TAG = 'PurgeManager';

// ─── Types ───────────────────────────────────────────────────────────────────

/**
 * Configuration for the purge manager.
 */
export interface PurgeConfig {
  /** Maximum days to keep synced records offline. Default: 30 */
  maxOfflineDays: number;
  /** Maximum days to keep completed sync queue items. Default: 7 */
  syncQueueRetentionDays: number;
  /** Maximum total storage usage in bytes before forcing purge. Default: 500MB */
  maxStorageBytes: number;
  /** Storage usage percentage that triggers a warning. Default: 0.8 (80%) */
  storageWarningThreshold: number;
  /** Whether to also purge attendance logs (vs. just queue items). Default: true */
  purgeAttendanceLogs: boolean;
  /** Whether to purge failed sync items. Default: false */
  purgeFailedItems: boolean;
  /** Minimum number of embeddings to keep per person (even if old). Default: 1 */
  minEmbeddingsPerPerson: number;
  /** Whether auto-purge is enabled. Default: true */
  autoPurgeEnabled: boolean;
}

/** Default purge configuration */
const DEFAULT_PURGE_CONFIG: PurgeConfig = {
  maxOfflineDays: 30,
  syncQueueRetentionDays: 7,
  maxStorageBytes: 500 * 1024 * 1024, // 500 MB
  storageWarningThreshold: 0.8,
  purgeAttendanceLogs: true,
  purgeFailedItems: false,
  minEmbeddingsPerPerson: 1,
  autoPurgeEnabled: true,
};

/**
 * Storage statistics for the FaceGuard database.
 */
export interface StorageStats {
  /** Total database file size in bytes */
  totalSizeBytes: number;
  /** Human-readable total size */
  totalSizeFormatted: string;
  /** Number of personnel records */
  personnelCount: number;
  /** Number of embedding records */
  embeddingCount: number;
  /** Number of attendance log records */
  attendanceLogCount: number;
  /** Number of pending sync queue items */
  pendingSyncItems: number;
  /** Number of completed sync queue items */
  completedSyncItems: number;
  /** Number of failed sync queue items */
  failedSyncItems: number;
  /** Storage usage as fraction of max (0-1) */
  usageRatio: number;
  /** Whether storage usage exceeds warning threshold */
  isWarning: boolean;
  /** Whether storage is critically full */
  isCritical: boolean;
  /** Oldest unsynced record age in days */
  oldestUnsyncedDays: number;
  /** Timestamp of the stats collection */
  timestamp: number;
}

/**
 * Result of a purge operation.
 */
export interface PurgeResult {
  /** Whether the purge completed successfully */
  success: boolean;
  /** Total records purged across all tables */
  totalPurged: number;
  /** Attendance logs purged */
  attendanceLogsPurged: number;
  /** Sync queue items purged */
  syncQueuePurged: number;
  /** Embeddings purged */
  embeddingsPurged: number;
  /** Space freed in bytes */
  spaceFreedBytes: number;
  /** Human-readable space freed */
  spaceFreedFormatted: string;
  /** Duration of the purge operation (ms) */
  durationMs: number;
  /** Errors encountered during purge */
  errors: string[];
  /** Timestamp of the purge */
  timestamp: number;
}

/**
 * Interface for the database adapter used by PurgeManager.
 */
export interface PurgeDBAdapter {
  executeSql(
    sql: string,
    params?: unknown[],
  ): Promise<{
    rows: unknown[];
    rowsAffected?: number;
  }>;
  getDatabaseSize(): Promise<number>;
}

/**
 * Data lifecycle manager for FaceGuard Offline.
 *
 * Manages automatic purging of old synced data to maintain
 * device storage health. Designed for background-fetch scheduling.
 *
 * Purge rules:
 * 1. Synced attendance logs older than MAX_OFFLINE_DAYS are purged
 * 2. Completed sync queue items older than retention period are purged
 * 3. Redundant embeddings beyond minimum per person are purged
 * 4. Emergency purge triggered when storage exceeds critical threshold
 *
 * @example
 * ```typescript
 * const purgeManager = new PurgeManager(dbAdapter);
 *
 * // Check if purge is needed
 * if (await purgeManager.shouldPurge()) {
 *   const result = await purgeManager.purgeStaleRecords();
 *   console.log(`Purged ${result.totalPurged} records, ` +
 *               `freed ${result.spaceFreedFormatted}`);
 * }
 *
 * // Get storage stats
 * const stats = await purgeManager.getStorageStats();
 * console.log(`Storage: ${stats.totalSizeFormatted} ` +
 *             `(${(stats.usageRatio * 100).toFixed(1)}%)`);
 * ```
 */
export class PurgeManager {
  private readonly db: PurgeDBAdapter;
  private readonly config: PurgeConfig;

  constructor(dbAdapter: PurgeDBAdapter, config: Partial<PurgeConfig> = {}) {
    this.db = dbAdapter;
    this.config = { ...DEFAULT_PURGE_CONFIG, ...config };
  }

  /**
   * Purges stale records that have been synced and exceed the
   * maximum offline retention period.
   *
   * Performs the following in order:
   * 1. Purge completed sync queue items
   * 2. Purge synced attendance logs (if enabled)
   * 3. Purge redundant embeddings
   * 4. Run SQLite VACUUM if significant space was freed
   *
   * @returns Detailed result of the purge operation.
   */
  async purgeStaleRecords(): Promise<PurgeResult> {
    const startTime = performance.now();
    const errors: string[] = [];
    let attendanceLogsPurged = 0;
    let syncQueuePurged = 0;
    let embeddingsPurged = 0;

    Logger.info(TAG, 'Starting stale records purge...');

    // Get pre-purge database size
    let prePurgeSize = 0;
    try {
      prePurgeSize = await this.db.getDatabaseSize();
    } catch (error) {
      Logger.warn(TAG, 'Could not determine pre-purge database size');
    }

    // 1. Purge completed sync queue items
    try {
      syncQueuePurged = await this.purgeSyncQueue();
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      errors.push(`Sync queue purge failed: ${msg}`);
      Logger.error(TAG, `Sync queue purge failed: ${msg}`);
    }

    // 2. Purge synced attendance logs
    if (this.config.purgeAttendanceLogs) {
      try {
        attendanceLogsPurged = await this.purgeAttendanceLogs();
      } catch (error) {
        const msg = error instanceof Error ? error.message : 'Unknown error';
        errors.push(`Attendance log purge failed: ${msg}`);
        Logger.error(TAG, `Attendance log purge failed: ${msg}`);
      }
    }

    // 3. Purge redundant embeddings
    try {
      embeddingsPurged = await this.purgeRedundantEmbeddings();
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      errors.push(`Embedding purge failed: ${msg}`);
      Logger.error(TAG, `Embedding purge failed: ${msg}`);
    }

    // 4. Purge failed items if configured
    if (this.config.purgeFailedItems) {
      try {
        const failedPurged = await this.purgeFailedSyncItems();
        syncQueuePurged += failedPurged;
      } catch (error) {
        const msg = error instanceof Error ? error.message : 'Unknown error';
        errors.push(`Failed items purge failed: ${msg}`);
      }
    }

    // 5. Run VACUUM if significant purge occurred
    const totalPurged = attendanceLogsPurged + syncQueuePurged + embeddingsPurged;
    if (totalPurged > 100) {
      try {
        await this.db.executeSql('VACUUM');
        Logger.info(TAG, 'Database VACUUM completed');
      } catch (error) {
        Logger.warn(TAG, 'VACUUM failed (non-critical)');
      }
    }

    // Calculate space freed
    let postPurgeSize = prePurgeSize;
    try {
      postPurgeSize = await this.db.getDatabaseSize();
    } catch {
      // Non-critical
    }

    const spaceFreedBytes = Math.max(0, prePurgeSize - postPurgeSize);
    const durationMs = performance.now() - startTime;

    const result: PurgeResult = {
      success: errors.length === 0,
      totalPurged,
      attendanceLogsPurged,
      syncQueuePurged,
      embeddingsPurged,
      spaceFreedBytes,
      spaceFreedFormatted: this.formatBytes(spaceFreedBytes),
      durationMs: Math.round(durationMs),
      errors,
      timestamp: Date.now(),
    };

    Logger.info(
      TAG,
      `Purge complete: ${totalPurged} records removed, ` +
        `${result.spaceFreedFormatted} freed in ${result.durationMs}ms` +
        (errors.length > 0 ? ` (${errors.length} errors)` : ''),
    );

    return result;
  }

  /**
   * Returns comprehensive storage statistics.
   */
  async getStorageStats(): Promise<StorageStats> {
    try {
      // Get database size
      let totalSizeBytes = 0;
      try {
        totalSizeBytes = await this.db.getDatabaseSize();
      } catch {
        Logger.warn(TAG, 'Could not determine database size');
      }

      // Get record counts
      const [
        personnelResult,
        embeddingResult,
        attendanceResult,
        pendingResult,
        completedResult,
        failedResult,
        oldestUnsyncedResult,
      ] = await Promise.all([
        this.db.executeSql('SELECT COUNT(*) as count FROM personnel WHERE is_active = 1'),
        this.db.executeSql('SELECT COUNT(*) as count FROM embeddings'),
        this.db.executeSql('SELECT COUNT(*) as count FROM attendance_log'),
        this.db.executeSql("SELECT COUNT(*) as count FROM sync_queue WHERE status = 'PENDING'"),
        this.db.executeSql("SELECT COUNT(*) as count FROM sync_queue WHERE status = 'COMPLETED'"),
        this.db.executeSql("SELECT COUNT(*) as count FROM sync_queue WHERE status = 'FAILED'"),
        this.db.executeSql('SELECT MIN(timestamp) as oldest FROM attendance_log WHERE synced = 0'),
      ]);

      const personnelCount = (personnelResult.rows[0] as { count: number }).count;
      const embeddingCount = (embeddingResult.rows[0] as { count: number }).count;
      const attendanceLogCount = (attendanceResult.rows[0] as { count: number }).count;
      const pendingSyncItems = (pendingResult.rows[0] as { count: number }).count;
      const completedSyncItems = (completedResult.rows[0] as { count: number }).count;
      const failedSyncItems = (failedResult.rows[0] as { count: number }).count;

      // Calculate oldest unsynced record age
      let oldestUnsyncedDays = 0;
      const oldest = (oldestUnsyncedResult.rows[0] as { oldest: string | null })?.oldest;
      if (oldest) {
        const ageMs = Date.now() - new Date(oldest).getTime();
        oldestUnsyncedDays = Math.floor(ageMs / (1000 * 60 * 60 * 24));
      }

      const usageRatio =
        this.config.maxStorageBytes > 0 ? totalSizeBytes / this.config.maxStorageBytes : 0;

      return {
        totalSizeBytes,
        totalSizeFormatted: this.formatBytes(totalSizeBytes),
        personnelCount,
        embeddingCount,
        attendanceLogCount,
        pendingSyncItems,
        completedSyncItems,
        failedSyncItems,
        usageRatio: Math.round(usageRatio * 1000) / 1000,
        isWarning: usageRatio >= this.config.storageWarningThreshold,
        isCritical: usageRatio >= 0.95,
        oldestUnsyncedDays,
        timestamp: Date.now(),
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      Logger.error(TAG, `Failed to get storage stats: ${errorMessage}`);
      throw new Error(`Storage stats failed: ${errorMessage}`);
    }
  }

  /**
   * Determines whether a purge operation should be run.
   *
   * Returns true if any of the following conditions are met:
   * 1. Storage usage exceeds the warning threshold
   * 2. There are synced records older than MAX_OFFLINE_DAYS
   * 3. There are completed sync queue items older than retention period
   *
   * @returns Whether a purge is recommended.
   */
  async shouldPurge(): Promise<boolean> {
    if (!this.config.autoPurgeEnabled) {
      return false;
    }

    try {
      // Check 1: Storage usage
      const stats = await this.getStorageStats();
      if (stats.isWarning || stats.isCritical) {
        Logger.info(TAG, `Purge recommended: storage at ${(stats.usageRatio * 100).toFixed(1)}%`);
        return true;
      }

      // Check 2: Old synced attendance records
      const oldAttendanceResult = await this.db.executeSql(
        `SELECT COUNT(*) as count FROM attendance_log
         WHERE synced = 1
         AND timestamp < datetime('now', '-' || ? || ' days')`,
        [this.config.maxOfflineDays],
      );
      const oldAttendanceCount = (oldAttendanceResult.rows[0] as { count: number }).count;
      if (oldAttendanceCount > 0) {
        Logger.info(TAG, `Purge recommended: ${oldAttendanceCount} old synced attendance records`);
        return true;
      }

      // Check 3: Old completed sync queue items
      const oldSyncResult = await this.db.executeSql(
        `SELECT COUNT(*) as count FROM sync_queue
         WHERE status = 'COMPLETED'
         AND synced_at < datetime('now', '-' || ? || ' days')`,
        [this.config.syncQueueRetentionDays],
      );
      const oldSyncCount = (oldSyncResult.rows[0] as { count: number }).count;
      if (oldSyncCount > 0) {
        Logger.info(TAG, `Purge recommended: ${oldSyncCount} old completed sync items`);
        return true;
      }

      return false;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      Logger.error(TAG, `shouldPurge check failed: ${errorMessage}`);
      // Default to true on error to be safe about storage
      return true;
    }
  }

  // ─── Private Purge Methods ─────────────────────────────────────────────────

  /**
   * Purges completed sync queue items older than the retention period.
   */
  private async purgeSyncQueue(): Promise<number> {
    const result = await this.db.executeSql(
      `DELETE FROM sync_queue
       WHERE status = 'COMPLETED'
       AND synced_at < datetime('now', '-' || ? || ' days')`,
      [this.config.syncQueueRetentionDays],
    );

    const purgedCount = result.rowsAffected || 0;

    if (purgedCount > 0) {
      Logger.info(TAG, `Purged ${purgedCount} completed sync queue items`);
    }

    return purgedCount;
  }

  /**
   * Purges synced attendance logs older than MAX_OFFLINE_DAYS.
   */
  private async purgeAttendanceLogs(): Promise<number> {
    const result = await this.db.executeSql(
      `DELETE FROM attendance_log
       WHERE synced = 1
       AND timestamp < datetime('now', '-' || ? || ' days')`,
      [this.config.maxOfflineDays],
    );

    const purgedCount = result.rowsAffected || 0;

    if (purgedCount > 0) {
      Logger.info(TAG, `Purged ${purgedCount} synced attendance logs`);
    }

    return purgedCount;
  }

  /**
   * Purges redundant embeddings while keeping the minimum required
   * per person (prioritizing highest quality embeddings).
   */
  private async purgeRedundantEmbeddings(): Promise<number> {
    // Find personnel with more embeddings than the minimum
    const excessResult = await this.db.executeSql(
      `SELECT personnel_id, COUNT(*) as count
       FROM embeddings
       GROUP BY personnel_id
       HAVING count > ?`,
      [this.config.minEmbeddingsPerPerson],
    );

    let totalPurged = 0;

    for (const row of excessResult.rows) {
      const { personnel_id: personnelId, count } = row as {
        personnel_id: string;
        count: number;
      };

      const excess = count - this.config.minEmbeddingsPerPerson;

      if (excess > 0) {
        // Delete lowest quality, oldest embeddings (keep primary and best quality)
        const deleteResult = await this.db.executeSql(
          `DELETE FROM embeddings
           WHERE id IN (
             SELECT id FROM embeddings
             WHERE personnel_id = ? AND is_primary = 0
             ORDER BY quality_score ASC, created_at ASC
             LIMIT ?
           )`,
          [personnelId, excess],
        );

        totalPurged += deleteResult.rowsAffected || 0;
      }
    }

    if (totalPurged > 0) {
      Logger.info(TAG, `Purged ${totalPurged} redundant embeddings`);
    }

    return totalPurged;
  }

  /**
   * Purges permanently failed sync items.
   */
  private async purgeFailedSyncItems(): Promise<number> {
    const result = await this.db.executeSql(
      `DELETE FROM sync_queue
       WHERE status = 'FAILED'
       AND created_at < datetime('now', '-' || ? || ' days')`,
      [this.config.maxOfflineDays],
    );

    const purgedCount = result.rowsAffected || 0;

    if (purgedCount > 0) {
      Logger.info(TAG, `Purged ${purgedCount} failed sync items`);
    }

    return purgedCount;
  }

  // ─── Utility Methods ───────────────────────────────────────────────────────

  /**
   * Formats a byte count into a human-readable string.
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) {
      return '0 B';
    }

    const units = ['B', 'KB', 'MB', 'GB'];
    const base = 1024;
    const unitIndex = Math.min(Math.floor(Math.log(bytes) / Math.log(base)), units.length - 1);

    const value = bytes / Math.pow(base, unitIndex);
    return `${value.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
  }
}
