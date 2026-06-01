import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { useNetworkSync } from '../hooks/useNetworkSync';
import { SyncQueue } from '../modules/SyncManager/SyncQueue';
import { AWSUploader } from '../modules/SyncManager/AWSUploader';
import { VaultManager } from '../modules/BiometricVault';

export const SyncStatusScreen: React.FC<any> = ({ navigation }) => {
  const {
    isOnline,
    isSyncing,
    unsyncedCount,
    lastSyncTime,
    manualSync,
  } = useNetworkSync();

  const [queueStats, setQueueStats] = useState({
    total: 0,
    local: 0,
    syncing: 0,
    synced: 0,
    failed: 0,
  });

  const [testingConnection, setTestingConnection] = useState(false);
  const [networkType, setNetworkType] = useState('none');
  const [syncHistory, setSyncHistory] = useState<string[]>([]);

  const loadQueueStats = async () => {
    const queue = new SyncQueue();
    const stats = await queue.getQueueStatus();
    setQueueStats(stats);
  };

  useEffect(() => {
    loadQueueStats();
    
    const unsubscribeNet = NetInfo.addEventListener((state) => {
      setNetworkType(state.type);
    });

    return () => unsubscribeNet();
  }, []);

  const handleSync = async () => {
    if (isSyncing) return;
    const initialCount = unsyncedCount;
    await manualSync();
    await loadQueueStats();
    
    const timestamp = new Date().toLocaleTimeString();
    setSyncHistory((prev) => [
      `[${timestamp}] Synced ${initialCount} records successfully.`,
      ...prev.slice(0, 9),
    ]);
  };

  const handleTestConnection = async () => {
    setTestingConnection(true);
    const uploader = new AWSUploader();
    const connected = await uploader.testConnectivity();
    setTestingConnection(false);

    if (connected) {
      Alert.alert('Connection Success ✅', 'DynamoDB table connection verified.');
    } else {
      Alert.alert('Connection Failed ❌', 'Could not reach AWS. Check network configuration.');
    }
  };

  const handleExportCSV = async () => {
    const vault = VaultManager.getInstance();
    const unsynced = await vault.getUnsyncedRecords();
    if (unsynced.length === 0) {
      Alert.alert('Export CSV', 'No pending records.');
      return;
    }
    const header = 'id,employee_id,action,timestamp,sync_status\n';
    const rows = unsynced.map(log => 
      `"${log.id}","${log.employee_id}","${log.action}",${log.timestamp},"${log.sync_status}"`
    ).join('\n');
    Alert.alert('CSV Generated ✅', header + rows);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Datalake 3.0 Sync Dashboard</Text>
      <Text style={styles.subtitle}>Audit logs & Cloud synchronisation portal</Text>

      {/* Network Panel */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Network State</Text>
        <Text style={styles.metricText}>
          Status: <Text style={{ color: isOnline ? '#22C55E' : '#EF4444', fontWeight: '800' }}>
            {isOnline ? 'ONLINE' : 'OFFLINE'}
          </Text>
        </Text>
        <Text style={styles.metricText}>Connection Type: {networkType.toUpperCase()}</Text>
      </View>

      {/* Counters Grid */}
      <View style={styles.statsGrid}>
        <View style={styles.statBox}>
          <Text style={styles.statNum}>{queueStats.local}</Text>
          <Text style={styles.statLabel}>Local</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={[styles.statNum, { color: '#F59E0B' }]}>{queueStats.syncing}</Text>
          <Text style={styles.statLabel}>Syncing</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={[styles.statNum, { color: '#22C55E' }]}>{queueStats.synced}</Text>
          <Text style={styles.statLabel}>Synced</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={[styles.statNum, { color: '#EF4444' }]}>{queueStats.failed}</Text>
          <Text style={styles.statLabel}>Failed</Text>
        </View>
      </View>

      {/* Actions */}
      <TouchableOpacity
        style={[styles.btn, isSyncing && styles.btnDisabled]}
        onPress={handleSync}
        disabled={isSyncing}
      >
        {isSyncing ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={styles.btnText}>Sync Queue Now</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.btn, styles.secondaryBtn]}
        onPress={handleTestConnection}
        disabled={testingConnection}
      >
        {testingConnection ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={styles.btnText}>Test AWS Connection</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.btn, styles.secondaryBtn, { borderColor: '#F59E0B' }]}
        onPress={handleExportCSV}
      >
        <Text style={[styles.btnText, { color: '#F59E0B' }]}>Download Queue CSV</Text>
      </TouchableOpacity>

      {/* Sync history log */}
      <View style={styles.historyCard}>
        <Text style={styles.cardTitle}>Sync History Log</Text>
        {syncHistory.length === 0 ? (
          <Text style={styles.historyPlaceholder}>No sync logs recorded in this session</Text>
        ) : (
          syncHistory.map((item, index) => (
            <Text key={index} style={styles.historyLogText}>{item}</Text>
          ))
        )}
      </View>

      <Text style={styles.lastSyncText}>
        Last successful sync: {lastSyncTime ? lastSyncTime.toLocaleString() : 'Never'}
      </Text>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  title: {
    fontSize: 24,
    fontWeight: '900',
    color: '#FFFFFF',
    marginTop: 20,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 15,
    color: '#FF6B00',
    marginBottom: 24,
    fontWeight: '700',
  },
  card: {
    backgroundColor: 'rgba(26, 60, 94, 0.2)',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    marginBottom: 20,
  },
  cardTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 12,
  },
  metricText: {
    color: '#94A3B8',
    fontSize: 16,
    marginVertical: 4,
    fontWeight: '600',
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 24,
  },
  statBox: {
    flex: 1,
    backgroundColor: 'rgba(26, 60, 94, 0.2)',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  statNum: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '900',
  },
  statLabel: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 4,
  },
  btn: {
    backgroundColor: '#FF6B00',
    height: 56, // Large button sizes for gloved field agents
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 8,
  },
  btnDisabled: {
    backgroundColor: 'rgba(255, 107, 0, 0.3)',
  },
  secondaryBtn: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  btnText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
  },
  historyCard: {
    backgroundColor: 'rgba(26, 60, 94, 0.1)',
    padding: 16,
    borderRadius: 12,
    marginTop: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  historyPlaceholder: {
    color: '#94A3B8',
    fontSize: 15,
    fontStyle: 'italic',
  },
  historyLogText: {
    color: '#22C55E',
    fontSize: 14,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    marginVertical: 4,
    fontWeight: '600',
  },
  lastSyncText: {
    color: '#94A3B8',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 30,
    fontWeight: '700',
  },
});

export default SyncStatusScreen;
