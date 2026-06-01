import { VaultManager } from '../BiometricVault';

export interface PurgeResult {
  purgedCount: number;
}

export interface RetentionReport {
  totalRecords: number;
  purgeable: number;
  retained: number;
  oldestRecord: string | null;
}

export class PurgeManager {
  constructor() {}

  /**
   * Zero-fills sensitive fields for synced records (scrubbing liveness scores, gps coordinates,
   * and match confidence parameters) while keeping audit log records.
   */
  async purgeAfterSync(syncedIds: string[]): Promise<PurgeResult> {
    if (syncedIds.length === 0) return { purgedCount: 0 };

    const vault = VaultManager.getInstance();
    const db = (vault as any).db;
    if (!db) return { purgedCount: 0 };

    const placeholders = syncedIds.map(() => '?').join(',');

    try {
      await db.transaction((tx: any) => {
        tx.executeSql(
          `UPDATE attendance_log 
           SET liveness_passive_score = NULL,
               gps_lat = NULL,
               gps_lng = NULL,
               recognition_confidence = NULL,
               inference_ms = NULL,
               sync_status = 'PURGED',
               purged_at = ?
           WHERE id IN (${placeholders}) AND sync_status = 'SYNCED' AND synced_at IS NOT NULL`,
          [Date.now(), ...syncedIds]
        );
      });
      return { purgedCount: syncedIds.length };
    } catch (e) {
      console.error(e);
      return { purgedCount: 0 };
    }
  }

  async getRetentionReport(): Promise<RetentionReport> {
    const vault = VaultManager.getInstance();
    const db = (vault as any).db;
    if (!db) {
      return { totalRecords: 0, purgeable: 0, retained: 0, oldestRecord: null };
    }

    try {
      const totalRes = await db.executeSql('SELECT COUNT(*) as count FROM attendance_log');
      const purgeableRes = await db.executeSql(
        "SELECT COUNT(*) as count FROM attendance_log WHERE sync_status = 'SYNCED'"
      );
      const retainedRes = await db.executeSql(
        "SELECT COUNT(*) as count FROM attendance_log WHERE sync_status = 'PURGED'"
      );
      const oldestRes = await db.executeSql(
        'SELECT MIN(timestamp) as oldest FROM attendance_log'
      );

      const totalRecords = totalRes[0].rows.item(0).count;
      const purgeable = purgeableRes[0].rows.item(0).count;
      const retained = retainedRes[0].rows.item(0).count;
      const oldestTime = oldestRes[0].rows.item(0).oldest;

      return {
        totalRecords,
        purgeable,
        retained,
        oldestRecord: oldestTime ? new Date(oldestTime).toISOString() : null,
      };
    } catch (e) {
      console.error(e);
      return { totalRecords: 0, purgeable: 0, retained: 0, oldestRecord: null };
    }
  }
}
export default PurgeManager;
