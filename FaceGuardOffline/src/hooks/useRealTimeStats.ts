import { useEffect } from 'react';
import { DeviceEventEmitter } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { VaultManager } from '../modules/BiometricVault';

export const REALTIME_STATS_QUERY_KEY = ['faceguard', 'real-time-stats'] as const;
export const REALTIME_STATS_SYNC_EVENT = 'faceguard:sync-complete';

export interface RealTimeStats {
  enrolled: number;
  todayCheckins: number;
  unsyncedCount: number;
  spoofAttempts: number;
}

async function loadRealTimeStats(): Promise<RealTimeStats> {
  const vault = VaultManager.getInstance();
  const todayStart = new Date().setHours(0, 0, 0, 0);
  const [enrolled, todayAttendance, unsyncedRecords, spoofLogs] = await Promise.all([
    vault.getEmployeeCount(),
    vault.getTodayAttendance(),
    vault.getUnsyncedRecords(),
    vault.getSpoofAttempts(todayStart),
  ]);

  const stats = {
    enrolled,
    todayCheckins: todayAttendance.length,
    unsyncedCount: unsyncedRecords.length,
    spoofAttempts: spoofLogs.length,
  };

  return stats;
}

export function emitRealTimeStatsSyncEvent(): void {
  DeviceEventEmitter.emit(REALTIME_STATS_SYNC_EVENT);
}

export function useRealTimeStats(isActive = true) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: REALTIME_STATS_QUERY_KEY,
    queryFn: loadRealTimeStats,
    enabled: isActive,
    staleTime: Infinity,
    refetchInterval: isActive ? 30000 : false,
    refetchIntervalInBackground: false,
    networkMode: 'always',
  });

  useEffect(() => {
    if (!isActive) {
      return undefined;
    }

    const subscription = DeviceEventEmitter.addListener(REALTIME_STATS_SYNC_EVENT, () => {
      queryClient.invalidateQueries({ queryKey: REALTIME_STATS_QUERY_KEY });
      query.refetch();
    });

    return () => subscription.remove();
  }, [isActive, query, queryClient]);

  return {
    enrolled: query.data?.enrolled ?? 0,
    todayCheckins: query.data?.todayCheckins ?? 0,
    unsyncedCount: query.data?.unsyncedCount ?? 0,
    spoofAttempts: query.data?.spoofAttempts ?? 0,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}

export default useRealTimeStats;
