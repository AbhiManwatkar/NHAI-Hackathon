import { VaultManager, AttendanceLog } from '../BiometricVault';

export interface QueueStatus {
  total: number;
  local: number;
  syncing: number;
  synced: number;
  failed: number;
}

export class SyncQueue {
  private vault = VaultManager.getInstance();

  constructor() {}

  async getUnsyncedCount(): Promise<number> {
    const unsynced = await this.vault.getUnsyncedRecords();
    return unsynced.length;
  }

  async getUnsyncedBatch(limit: number = 50): Promise<AttendanceLog[]> {
    const unsynced = await this.vault.getUnsyncedRecords();
    return unsynced.slice(0, limit);
  }

  async markBatchSyncing(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    // Set status to SYNCING in the database
    const vault = VaultManager.getInstance();
    // Update local attendance log status
    const db = (vault as any).db;
    if (!db) return;
    const placeholders = ids.map(() => '?').join(',');
    await db.transaction((tx: any) => {
      tx.executeSql(
        `UPDATE attendance_log SET sync_status = 'SYNCING' WHERE id IN (${placeholders})`,
        ids
      );
    });
  }

  async markBatchSynced(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    const vault = VaultManager.getInstance();
    await vault.markSynced(ids);
  }

  async markBatchFailed(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    const vault = VaultManager.getInstance();
    const db = (vault as any).db;
    if (!db) return;
    const placeholders = ids.map(() => '?').join(',');
    await db.transaction((tx: any) => {
      tx.executeSql(
        `UPDATE attendance_log SET sync_status = 'LOCAL' WHERE id IN (${placeholders})`,
        ids
      );
    });
  }

  async purgeConfirmedRecords(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    const vault = VaultManager.getInstance();
    await vault.purgeRecords(ids);
  }

  async getQueueStatus(): Promise<QueueStatus> {
    const vault = VaultManager.getInstance();
    const db = (vault as any).db;
    if (!db) {
      return { total: 0, local: 0, syncing: 0, synced: 0, failed: 0 };
    }

    try {
      const results = await db.executeSql(`
        SELECT sync_status, COUNT(*) as count 
        FROM attendance_log 
        GROUP BY sync_status
      `);
      
      const counts: Record<string, number> = {
        LOCAL: 0,
        SYNCING: 0,
        SYNCED: 0,
        FAILED: 0,
      };

      const rows = results[0].rows;
      for (let i = 0; i < rows.length; i++) {
        const item = rows.item(i);
        counts[item.sync_status] = item.count;
      }

      const total = Object.values(counts).reduce((a, b) => a + b, 0);

      return {
        total,
        local: counts.LOCAL || 0,
        syncing: counts.SYNCING || 0,
        synced: counts.SYNCED || 0,
        failed: counts.FAILED || 0,
      };
    } catch (e) {
      console.error(e);
      return { total: 0, local: 0, syncing: 0, synced: 0, failed: 0 };
    }
  }
}
