import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Alert,
  Platform,
} from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { VaultManager, AttendanceLog } from '../modules/BiometricVault';
import { SyncBanner } from '../components/SyncBanner';

type FilterType = 'ALL' | 'CHECK_IN' | 'CHECK_OUT' | 'PENDING_SYNC';

export const AttendanceLogScreen: React.FC = () => {
  const [logs, setLogs] = useState<AttendanceLog[]>([]);
  const [filter, setFilter] = useState<FilterType>('ALL');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'OFFLINE' | 'SYNCING' | 'SYNCED'>('OFFLINE');
  const [syncQueueCount, setSyncQueueCount] = useState(0);

  const loadLogs = useCallback(async () => {
    try {
      const vault = VaultManager.getInstance();
      const todayLogs = await vault.getTodayAttendance();
      setLogs(todayLogs);
      
      const unsynced = await vault.getUnsyncedRecords();
      setSyncQueueCount(unsynced.length);
      setSyncStatus(unsynced.length > 0 ? 'OFFLINE' : 'SYNCED');
    } catch (error) {
      console.error('[AttendanceLogScreen] Failed to load attendance logs:', error);
    }
  }, []);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    // Simulate AWS Sync on Pull-to-refresh
    if (syncQueueCount > 0) {
      setSyncStatus('SYNCING');
      await new Promise((resolve) => setTimeout(resolve, 2000));
      
      const vault = VaultManager.getInstance();
      const unsynced = await vault.getUnsyncedRecords();
      const ids = unsynced.map(log => log.id);
      await vault.markSynced(ids);
    }
    
    await loadLogs();
    setIsRefreshing(false);
  };

  const handleExportCSV = async () => {
    try {
      const vault = VaultManager.getInstance();
      const unsynced = await vault.getUnsyncedRecords();
      if (unsynced.length === 0) {
        Alert.alert('Export CSV', 'No pending offline logs to export.');
        return;
      }

      // Generate simple CSV string representation
      const header = 'id,employee_id,action,timestamp,liveness_passive_score,recognition_confidence,inference_ms,sync_status\n';
      const rows = unsynced.map(log => 
        `"${log.id}","${log.employee_id}","${log.action}",${log.timestamp},${log.liveness_passive_score},${log.recognition_confidence},${log.inference_ms},"${log.sync_status}"`
      ).join('\n');
      
      const csvContent = header + rows;
      // In production, we write using react-native-fs, for the hackathon we trigger alert with CSV summary
      Alert.alert('CSV Exported Successfully ✅', `Generated CSV payload:\n\n${csvContent.substring(0, 200)}...`);
    } catch (err) {
      Alert.alert('Export Failed', String(err));
    }
  };

  const handleLongPress = (item: AttendanceLog) => {
    Alert.alert(
      'Attendance Details',
      `Log ID: ${item.id}\nAction: ${item.action}\nTime: ${new Date(item.timestamp).toLocaleTimeString()}\nConfidence: ${(item.recognition_confidence * 100).toFixed(1)}%\nLiveness Score: ${(item.liveness_passive_score * 100).toFixed(1)}%\nInference Latency: ${item.inference_ms}ms\nSync Status: ${item.sync_status}`,
      [{ text: 'Dismiss' }]
    );
  };

  const filteredLogs = logs.filter((log) => {
    if (filter === 'CHECK_IN') return log.action === 'CHECK_IN';
    if (filter === 'CHECK_OUT') return log.action === 'CHECK_OUT';
    if (filter === 'PENDING_SYNC') return log.sync_status === 'LOCAL';
    return true;
  });

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>NHAI Field Logs</Text>
        <TouchableOpacity style={styles.exportBtn} onPress={handleExportCSV}>
          <Text style={styles.exportBtnText}>📤 Export CSV</Text>
        </TouchableOpacity>
      </View>

      {/* SyncBanner at the top */}
      <SyncBanner
        status={syncStatus}
        queueCount={syncQueueCount}
        syncProgress={50}
        onPress={handleRefresh}
      />

      <View style={styles.filterRow}>
        {(['ALL', 'CHECK_IN', 'CHECK_OUT', 'PENDING_SYNC'] as FilterType[]).map((type) => (
          <TouchableOpacity
            key={type}
            style={[styles.filterChip, filter === type && styles.activeChip]}
            onPress={() => setFilter(type)}
          >
            <Text style={[styles.chipText, filter === type && styles.activeChipText]}>
              {type === 'PENDING_SYNC' ? 'Pending' : type}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={filteredLogs}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor="#FF6B00" />
        }
        renderItem={({ item, index }) => (
          <Animated.View entering={FadeInUp.delay(index * 50)}>
            <TouchableOpacity
              onLongPress={() => handleLongPress(item)}
              style={styles.card}
              activeOpacity={0.8}
            >
              <View style={styles.cardLeft}>
                <View
                  style={[
                    styles.actionIndicator,
                    { backgroundColor: item.action === 'CHECK_IN' ? '#22C55E' : '#EF4444' },
                  ]}
                />
                <View>
                  <Text style={styles.empName}>Employee {item.employee_id?.substring(0, 6)}</Text>
                  <Text style={styles.cardMeta}>
                    {new Date(item.timestamp).toLocaleTimeString()} • {(item.recognition_confidence * 100).toFixed(1)}% match
                  </Text>
                </View>
              </View>
              <View style={styles.cardRight}>
                <View
                  style={[
                    styles.syncBadge,
                    { backgroundColor: item.sync_status === 'SYNCED' ? 'rgba(34, 197, 94, 0.15)' : 'rgba(245, 158, 11, 0.15)' },
                  ]}
                >
                  <Text
                    style={[
                      styles.syncBadgeText,
                      { color: item.sync_status === 'SYNCED' ? '#22C55E' : '#F59E0B' },
                    ]}
                  >
                    {item.sync_status === 'SYNCED' ? 'Synced' : 'Offline'}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          </Animated.View>
        )}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No attendance records found today</Text>
          </View>
        }
        ListFooterComponent={
          <View style={styles.footer}>
            <Text style={styles.footerText}>
              {logs.length} records today | {syncQueueCount} pending sync
            </Text>
          </View>
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  header: {
    height: 70,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    backgroundColor: '#1A3C5E',
  },
  title: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '900',
  },
  exportBtn: {
    backgroundColor: '#FF6B00',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    minHeight: 40,
    justifyContent: 'center',
  },
  exportBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  filterRow: {
    flexDirection: 'row',
    padding: 16,
    gap: 8,
    justifyContent: 'center',
  },
  filterChip: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  activeChip: {
    backgroundColor: 'rgba(255, 107, 0, 0.2)',
    borderColor: '#FF6B00',
  },
  chipText: {
    color: '#94A3B8',
    fontSize: 14,
    fontWeight: '700',
  },
  activeChipText: {
    color: '#FF6B00',
  },
  card: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(26, 60, 94, 0.2)',
    marginHorizontal: 16,
    marginVertical: 6,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  cardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  actionIndicator: {
    width: 8,
    height: 36,
    borderRadius: 4,
  },
  empName: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '800',
  },
  cardMeta: {
    color: '#94A3B8',
    fontSize: 14,
    marginTop: 4,
  },
  cardRight: {
    justifyContent: 'center',
  },
  syncBadge: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  syncBadgeText: {
    fontSize: 13,
    fontWeight: '800',
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    color: '#94A3B8',
    fontSize: 16,
    fontWeight: '600',
  },
  footer: {
    padding: 24,
    alignItems: 'center',
  },
  footerText: {
    color: '#94A3B8',
    fontSize: 15,
    fontWeight: '700',
  },
});

export default AttendanceLogScreen;
