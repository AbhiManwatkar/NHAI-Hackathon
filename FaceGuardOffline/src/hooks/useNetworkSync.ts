import { useState, useEffect, useCallback } from 'react';
import NetInfo from '@react-native-community/netinfo';
import { SyncManager } from '../modules/SyncManager';

export const useNetworkSync = () => {
  const syncManager = SyncManager.getInstance();

  const [isOnline, setIsOnline] = useState(false);
  const [isSyncing, setIsSyncing] = useState(syncManager.getIsSyncing());
  const [unsyncedCount, setUnsyncedCount] = useState(0);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(syncManager.getLastSyncTime());

  const checkPendingCount = useCallback(async () => {
    const queue = new (await import('../modules/SyncManager/SyncQueue')).SyncQueue();
    const count = await queue.getUnsyncedCount();
    setUnsyncedCount(count);
  }, []);

  useEffect(() => {
    checkPendingCount();

    // Listen to network changes
    const unsubscribeNet = NetInfo.addEventListener((state) => {
      setIsOnline(!!state.isConnected);
    });

    // Simple status poller to keep UI components updated
    const interval = setInterval(() => {
      setIsSyncing(syncManager.getIsSyncing());
      setLastSyncTime(syncManager.getLastSyncTime());
      checkPendingCount();
    }, 1000);

    return () => {
      unsubscribeNet();
      clearInterval(interval);
    };
  }, [syncManager, checkPendingCount]);

  const manualSync = useCallback(async () => {
    await syncManager.forceSyncAll();
    await checkPendingCount();
  }, [syncManager, checkPendingCount]);

  return {
    isOnline,
    isSyncing,
    unsyncedCount,
    lastSyncTime,
    manualSync,
    checkPendingCount,
  };
};

export default useNetworkSync;
