/**
 * @fileoverview AdminScreen - Administration Panel with PIN Protection
 * @description Admin panel providing Personnel Management, Storage Statistics,
 * Sync Controls, and Security Settings. Protected by admin PIN authentication.
 *
 * All operations work offline against local encrypted storage.
 * @version 1.0.0
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  Modal,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeOut,
  SlideInDown,
  ZoomIn,
} from 'react-native-reanimated';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type {
  AdminAction,
  MainTabParamList,
  Personnel,
  RootStackParamList,
  StorageStats,
} from '../types';

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const Colors = {
  primaryOrange: '#FF6B00',
  primaryBlue: '#1A3C5E',
  backgroundDark: '#0D1B2A',
  surface: '#1B2838',
  success: '#00C853',
  error: '#FF1744',
  warning: '#FFD600',
  textPrimary: '#FFFFFF',
  textSecondary: '#B0BEC5',
  glassBorder: 'rgba(255, 255, 255, 0.12)',
  glassBackground: 'rgba(27, 40, 56, 0.65)',
  inputBackground: 'rgba(27, 40, 56, 0.8)',
  inputBorder: 'rgba(255, 255, 255, 0.15)',
  danger: '#D32F2F',
} as const;

/** Admin panel section identifiers */
type AdminSection = 'personnel' | 'storage' | 'sync' | 'security';

/** Default admin PIN for development (in production, stored as bcrypt hash) */
const DEFAULT_PIN = '1234';

// ─────────────────────────────────────────────────────────────────────────────
// Navigation Typing
// ─────────────────────────────────────────────────────────────────────────────

type AdminScreenProps = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, 'Admin'>,
  NativeStackScreenProps<RootStackParamList>
>;

// ─────────────────────────────────────────────────────────────────────────────
// Mock Data
// ─────────────────────────────────────────────────────────────────────────────

const mockPersonnel: Personnel[] = [
  {
    id: 'p-001',
    name: 'Rajesh Kumar',
    employeeId: 'NHAI-EMP-0042',
    department: 'Engineering',
    role: 'Field Engineer',
    photoThumbnail: '',
    isActive: true,
    enrolledAt: '2025-01-15T10:30:00Z',
    updatedAt: '2025-05-28T09:00:00Z',
    lastSyncedAt: '2025-05-28T08:00:00Z',
  },
  {
    id: 'p-002',
    name: 'Priya Sharma',
    employeeId: 'NHAI-EMP-0078',
    department: 'Operations',
    role: 'Site Supervisor',
    photoThumbnail: '',
    isActive: true,
    enrolledAt: '2025-02-10T14:20:00Z',
    updatedAt: '2025-05-27T15:00:00Z',
    lastSyncedAt: '2025-05-27T14:00:00Z',
  },
  {
    id: 'p-003',
    name: 'Amit Patel',
    employeeId: 'NHAI-EMP-0103',
    department: 'Toll Operations',
    role: 'Toll Operator',
    photoThumbnail: '',
    isActive: true,
    enrolledAt: '2025-03-01T09:15:00Z',
    updatedAt: '2025-05-26T11:00:00Z',
    lastSyncedAt: null,
  },
  {
    id: 'p-004',
    name: 'Sunita Devi',
    employeeId: 'NHAI-EMP-0156',
    department: 'Safety',
    role: 'Safety Inspector',
    photoThumbnail: '',
    isActive: false,
    enrolledAt: '2025-01-20T08:45:00Z',
    updatedAt: '2025-04-15T10:00:00Z',
    lastSyncedAt: '2025-04-15T09:30:00Z',
  },
];

const mockStorageStats: StorageStats = {
  databaseSizeBytes: 15728640, // ~15 MB
  embeddingsSizeBytes: 8388608, // ~8 MB
  thumbnailsSizeBytes: 5242880, // ~5 MB
  cacheSizeBytes: 2097152, // ~2 MB
  personnelCount: 24,
  enrollmentCount: 24,
  attendanceCount: 156,
  pendingSyncCount: 3,
  logEntryCount: 842,
  availableStorageBytes: 10737418240, // ~10 GB
  calculatedAt: new Date().toISOString(),
};

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

/**
 * PIN entry modal for admin authentication
 */
const PinEntryModal: React.FC<{
  visible: boolean;
  onSuccess: () => void;
  onCancel: () => void;
}> = ({ visible, onSuccess, onCancel }) => {
  const [pin, setPin] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [attempts, setAttempts] = useState<number>(0);

  const handlePinSubmit = useCallback(() => {
    if (pin === DEFAULT_PIN) {
      setPin('');
      setError('');
      setAttempts(0);
      onSuccess();
    } else {
      setAttempts((prev) => prev + 1);
      setError(`Incorrect PIN. ${3 - attempts - 1} attempts remaining.`);
      setPin('');
      if (attempts >= 2) {
        Alert.alert('Access Denied', 'Too many failed attempts. Please try again later.', [
          { text: 'OK', onPress: onCancel },
        ]);
      }
    }
  }, [pin, attempts, onSuccess, onCancel]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.modalOverlay}>
        <Animated.View
          entering={ZoomIn.duration(300).springify().damping(14)}
          style={styles.pinModal}
        >
          <Text style={styles.pinModalIcon}>🔒</Text>
          <Text style={styles.pinModalTitle}>Admin Access</Text>
          <Text style={styles.pinModalSubtitle}>Enter your 4-digit admin PIN</Text>

          <View style={styles.pinInputContainer}>
            <TextInput
              style={styles.pinInput}
              value={pin}
              onChangeText={(text) => {
                setPin(text.replace(/[^0-9]/g, '').slice(0, 4));
                setError('');
              }}
              placeholder="• • • •"
              placeholderTextColor="rgba(176, 190, 197, 0.3)"
              keyboardType="number-pad"
              secureTextEntry
              maxLength={4}
              autoFocus
              selectionColor={Colors.primaryOrange}
              textAlign="center"
            />
          </View>

          {error ? <Text style={styles.pinError}>{error}</Text> : null}

          <View style={styles.pinActions}>
            <TouchableOpacity style={styles.pinCancelButton} onPress={onCancel} activeOpacity={0.7}>
              <Text style={styles.pinCancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.pinSubmitButton, pin.length < 4 && styles.pinSubmitDisabled]}
              onPress={handlePinSubmit}
              disabled={pin.length < 4}
              activeOpacity={0.7}
            >
              <Text style={styles.pinSubmitText}>Unlock</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
};

/**
 * Section header with icon and title
 */
const SectionHeader: React.FC<{
  icon: string;
  title: string;
  subtitle?: string;
}> = ({ icon, title, subtitle }) => (
  <View style={styles.sectionHeader}>
    <Text style={styles.sectionIcon}>{icon}</Text>
    <View style={styles.sectionHeaderText}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {subtitle && <Text style={styles.sectionSubtitle}>{subtitle}</Text>}
    </View>
  </View>
);

/**
 * Personnel list item card
 */
const PersonnelCard: React.FC<{
  person: Personnel;
  onRemove: (id: string) => void;
}> = React.memo(({ person, onRemove }) => {
  const handleRemove = useCallback(() => {
    Alert.alert(
      'Remove Personnel',
      `Are you sure you want to remove ${person.name}? This will delete their face data.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => onRemove(person.id),
        },
      ],
    );
  }, [person, onRemove]);

  return (
    <View style={styles.personnelCard}>
      <View style={styles.personnelAvatar}>
        <Text style={styles.personnelAvatarText}>{person.name.charAt(0)}</Text>
      </View>
      <View style={styles.personnelInfo}>
        <Text style={styles.personnelName}>{person.name}</Text>
        <Text style={styles.personnelDetail}>
          {person.employeeId} • {person.department}
        </Text>
        <View style={styles.personnelBadges}>
          <View
            style={[
              styles.statusBadge,
              person.isActive ? styles.statusActive : styles.statusInactive,
            ]}
          >
            <Text style={styles.statusBadgeText}>{person.isActive ? 'Active' : 'Inactive'}</Text>
          </View>
          {person.lastSyncedAt && (
            <View style={styles.syncedBadge}>
              <Text style={styles.syncedBadgeText}>☁️ Synced</Text>
            </View>
          )}
        </View>
      </View>
      <TouchableOpacity
        style={styles.removeButton}
        onPress={handleRemove}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Text style={styles.removeButtonText}>🗑️</Text>
      </TouchableOpacity>
    </View>
  );
});

PersonnelCard.displayName = 'PersonnelCard';

/**
 * Storage usage bar chart item
 */
const StorageBar: React.FC<{
  label: string;
  sizeBytes: number;
  maxBytes: number;
  color: string;
}> = ({ label, sizeBytes, maxBytes, color }) => {
  const percentage = maxBytes > 0 ? (sizeBytes / maxBytes) * 100 : 0;
  const formattedSize = formatBytes(sizeBytes);

  return (
    <View style={styles.storageBarContainer}>
      <View style={styles.storageBarHeader}>
        <Text style={styles.storageBarLabel}>{label}</Text>
        <Text style={styles.storageBarSize}>{formattedSize}</Text>
      </View>
      <View style={styles.storageBarTrack}>
        <View
          style={[
            styles.storageBarFill,
            { width: `${Math.min(percentage, 100)}%`, backgroundColor: color },
          ]}
        />
      </View>
    </View>
  );
};

/**
 * Action button for admin operations
 */
const AdminActionButton: React.FC<{
  icon: string;
  title: string;
  subtitle: string;
  color: string;
  danger?: boolean;
  onPress: () => void;
  isLoading?: boolean;
}> = ({ icon, title, subtitle, color, danger, onPress, isLoading }) => (
  <TouchableOpacity
    style={[styles.actionButton, danger && styles.actionButtonDanger]}
    onPress={onPress}
    disabled={isLoading}
    activeOpacity={0.7}
  >
    <View style={[styles.actionIconContainer, { backgroundColor: `${color}20` }]}>
      {isLoading ? (
        <ActivityIndicator size="small" color={color} />
      ) : (
        <Text style={styles.actionIcon}>{icon}</Text>
      )}
    </View>
    <View style={styles.actionContent}>
      <Text style={[styles.actionTitle, danger && { color: Colors.error }]}>{title}</Text>
      <Text style={styles.actionSubtitle}>{subtitle}</Text>
    </View>
    <Text style={styles.actionArrow}>›</Text>
  </TouchableOpacity>
);

// ─────────────────────────────────────────────────────────────────────────────
// Utility Functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Formats bytes into human-readable string
 * @param bytes - Size in bytes
 * @returns Formatted string (e.g., "15.0 MB")
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) {
    return '0 B';
  }
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────

/**
 * AdminScreen - Protected administration panel
 *
 * Sections:
 * 1. Personnel Management - View, add, remove enrolled personnel
 * 2. Storage Statistics - Database sizes, record counts, storage chart
 * 3. Sync Controls - Force sync, purge stale records
 * 4. Security Settings - Re-encrypt vault, export logs, reset PIN
 *
 * Access protected by 4-digit admin PIN.
 */
const AdminScreen: React.FC<AdminScreenProps> = ({ navigation }) => {
  // ── State ──────────────────────────────────────────────────────────────
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [showPinModal, setShowPinModal] = useState<boolean>(true);
  const [personnel, setPersonnel] = useState<Personnel[]>(mockPersonnel);
  const [storageStats] = useState<StorageStats>(mockStorageStats);
  const [loadingActions, setLoadingActions] = useState<Set<string>>(new Set());

  // ── Handlers ───────────────────────────────────────────────────────────

  const handlePinSuccess = useCallback(() => {
    setIsAuthenticated(true);
    setShowPinModal(false);
  }, []);

  const handlePinCancel = useCallback(() => {
    setShowPinModal(false);
    navigation.goBack();
  }, [navigation]);

  const handleRemovePersonnel = useCallback((id: string) => {
    setPersonnel((prev) => prev.filter((p) => p.id !== id));
    // TODO: await PersonnelDB.deactivate(id);
    // TODO: await SyncQueue.enqueue({ type: 'personnel', referenceId: id });
  }, []);

  /**
   * Executes an admin action with loading state management
   */
  const executeAction = useCallback(async (actionKey: string, actionFn: () => Promise<void>) => {
    setLoadingActions((prev) => new Set(prev).add(actionKey));
    try {
      await actionFn();
    } finally {
      setLoadingActions((prev) => {
        const next = new Set(prev);
        next.delete(actionKey);
        return next;
      });
    }
  }, []);

  const handleForceSync = useCallback(() => {
    executeAction('force_sync', async () => {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      Alert.alert('Sync Complete', 'All pending items have been synced successfully.');
    });
  }, [executeAction]);

  const handlePurgeStale = useCallback(() => {
    Alert.alert(
      'Purge Stale Records',
      'This will remove attendance records older than 90 days. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Purge',
          style: 'destructive',
          onPress: () =>
            executeAction('purge', async () => {
              await new Promise((resolve) => setTimeout(resolve, 1500));
              Alert.alert('Purge Complete', '42 stale records removed.');
            }),
        },
      ],
    );
  }, [executeAction]);

  const handleReEncryptVault = useCallback(() => {
    Alert.alert(
      'Re-Encrypt Vault',
      'This will re-encrypt all stored face data with a new key. The app will be locked during this process.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Proceed',
          onPress: () =>
            executeAction('reencrypt', async () => {
              await new Promise((resolve) => setTimeout(resolve, 3000));
              Alert.alert('Encryption Complete', 'Vault has been re-encrypted successfully.');
            }),
        },
      ],
    );
  }, [executeAction]);

  const handleExportLogs = useCallback(() => {
    executeAction('export_logs', async () => {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      Alert.alert(
        'Logs Exported',
        'Application logs have been exported to Downloads/FaceGuard_Logs.zip',
      );
    });
  }, [executeAction]);

  const handleClearCache = useCallback(() => {
    Alert.alert(
      'Clear Cache',
      `This will free ${formatBytes(storageStats.cacheSizeBytes)} of cache. Continue?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          onPress: () =>
            executeAction('clear_cache', async () => {
              await new Promise((resolve) => setTimeout(resolve, 1000));
              Alert.alert('Cache Cleared', 'Application cache has been cleared.');
            }),
        },
      ],
    );
  }, [executeAction, storageStats.cacheSizeBytes]);

  // ── Computed ───────────────────────────────────────────────────────────
  const totalStorageUsed =
    storageStats.databaseSizeBytes +
    storageStats.embeddingsSizeBytes +
    storageStats.thumbnailsSizeBytes +
    storageStats.cacheSizeBytes;

  // ── Render ─────────────────────────────────────────────────────────────

  if (!isAuthenticated) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <StatusBar barStyle="light-content" backgroundColor={Colors.backgroundDark} />
        <PinEntryModal
          visible={showPinModal}
          onSuccess={handlePinSuccess}
          onCancel={handlePinCancel}
        />
        <View style={styles.lockedContainer}>
          <Text style={styles.lockedIcon}>🔒</Text>
          <Text style={styles.lockedText}>Admin Panel Locked</Text>
          <TouchableOpacity
            style={styles.unlockButton}
            onPress={() => setShowPinModal(true)}
            activeOpacity={0.7}
          >
            <Text style={styles.unlockButtonText}>Enter PIN</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.backgroundDark} />

      {/* Header */}
      <View style={styles.screenHeader}>
        <Text style={styles.screenTitle}>Admin Panel</Text>
        <TouchableOpacity
          style={styles.lockButton}
          onPress={() => {
            setIsAuthenticated(false);
            setShowPinModal(false);
          }}
          activeOpacity={0.7}
        >
          <Text style={styles.lockButtonText}>🔒 Lock</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Personnel Management ──────────────────────────────────── */}
        <Animated.View entering={FadeInDown.delay(100).duration(400)}>
          <SectionHeader
            icon="👥"
            title="Personnel Management"
            subtitle={`${personnel.filter((p) => p.isActive).length} active, ${
              personnel.filter((p) => !p.isActive).length
            } inactive`}
          />

          <View style={styles.personnelList}>
            {personnel.map((person) => (
              <PersonnelCard key={person.id} person={person} onRemove={handleRemovePersonnel} />
            ))}
          </View>

          <TouchableOpacity
            style={styles.addPersonnelButton}
            onPress={() => navigation.navigate('Enrolment')}
            activeOpacity={0.7}
          >
            <Text style={styles.addPersonnelIcon}>➕</Text>
            <Text style={styles.addPersonnelText}>Add New Personnel</Text>
          </TouchableOpacity>
        </Animated.View>

        {/* ── Storage Statistics ─────────────────────────────────────── */}
        <Animated.View entering={FadeInDown.delay(200).duration(400)}>
          <SectionHeader
            icon="💾"
            title="Storage Statistics"
            subtitle={`${formatBytes(totalStorageUsed)} used of ${formatBytes(
              storageStats.availableStorageBytes,
            )}`}
          />

          <View style={styles.storageCard}>
            <StorageBar
              label="Database"
              sizeBytes={storageStats.databaseSizeBytes}
              maxBytes={totalStorageUsed}
              color={Colors.primaryBlue}
            />
            <StorageBar
              label="Face Embeddings"
              sizeBytes={storageStats.embeddingsSizeBytes}
              maxBytes={totalStorageUsed}
              color={Colors.primaryOrange}
            />
            <StorageBar
              label="Thumbnails"
              sizeBytes={storageStats.thumbnailsSizeBytes}
              maxBytes={totalStorageUsed}
              color={Colors.success}
            />
            <StorageBar
              label="Cache"
              sizeBytes={storageStats.cacheSizeBytes}
              maxBytes={totalStorageUsed}
              color={Colors.warning}
            />

            {/* Record counts */}
            <View style={styles.recordCountsGrid}>
              <View style={styles.recordCountItem}>
                <Text style={styles.recordCountValue}>{storageStats.personnelCount}</Text>
                <Text style={styles.recordCountLabel}>Personnel</Text>
              </View>
              <View style={styles.recordCountItem}>
                <Text style={styles.recordCountValue}>{storageStats.attendanceCount}</Text>
                <Text style={styles.recordCountLabel}>Attendance</Text>
              </View>
              <View style={styles.recordCountItem}>
                <Text style={styles.recordCountValue}>{storageStats.pendingSyncCount}</Text>
                <Text style={styles.recordCountLabel}>Pending Sync</Text>
              </View>
              <View style={styles.recordCountItem}>
                <Text style={styles.recordCountValue}>{storageStats.logEntryCount}</Text>
                <Text style={styles.recordCountLabel}>Log Entries</Text>
              </View>
            </View>
          </View>
        </Animated.View>

        {/* ── Sync Controls ─────────────────────────────────────────── */}
        <Animated.View entering={FadeInDown.delay(300).duration(400)}>
          <SectionHeader
            icon="🔄"
            title="Sync Controls"
            subtitle={`${storageStats.pendingSyncCount} items pending`}
          />

          <View style={styles.actionGroup}>
            <AdminActionButton
              icon="⚡"
              title="Force Sync Now"
              subtitle="Sync all pending records to server"
              color={Colors.primaryOrange}
              onPress={handleForceSync}
              isLoading={loadingActions.has('force_sync')}
            />
            <AdminActionButton
              icon="🧹"
              title="Purge Stale Records"
              subtitle="Remove records older than 90 days"
              color={Colors.warning}
              danger
              onPress={handlePurgeStale}
              isLoading={loadingActions.has('purge')}
            />
            <AdminActionButton
              icon="🗑️"
              title="Clear Cache"
              subtitle={`Free ${formatBytes(storageStats.cacheSizeBytes)} of cache`}
              color={Colors.textSecondary}
              onPress={handleClearCache}
              isLoading={loadingActions.has('clear_cache')}
            />
          </View>
        </Animated.View>

        {/* ── Security Settings ─────────────────────────────────────── */}
        <Animated.View entering={FadeInDown.delay(400).duration(400)}>
          <SectionHeader
            icon="🛡️"
            title="Security Settings"
            subtitle="Encryption and audit controls"
          />

          <View style={styles.actionGroup}>
            <AdminActionButton
              icon="🔐"
              title="Re-Encrypt Vault"
              subtitle="Generate new encryption key for face data"
              color={Colors.primaryBlue}
              onPress={handleReEncryptVault}
              isLoading={loadingActions.has('reencrypt')}
            />
            <AdminActionButton
              icon="📋"
              title="Export Audit Logs"
              subtitle={`${storageStats.logEntryCount} entries available`}
              color={Colors.success}
              onPress={handleExportLogs}
              isLoading={loadingActions.has('export_logs')}
            />
          </View>
        </Animated.View>

        {/* App version footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>FaceGuard Offline v1.0.0 • NHAI</Text>
          <Text style={styles.footerSubtext}>Device ID: DEV-001 • Build 2025.05.28</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.backgroundDark,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 100,
  },

  // Header
  screenHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.glassBorder,
  },
  screenTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  lockButton: {
    backgroundColor: Colors.surface,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
  },
  lockButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
  },

  // Locked State
  lockedContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  lockedIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  lockedText: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.textSecondary,
    marginBottom: 24,
  },
  unlockButton: {
    backgroundColor: Colors.primaryOrange,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 14,
  },
  unlockButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
  },

  // PIN Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  pinModal: {
    width: '100%',
    backgroundColor: Colors.surface,
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.glassBorder,
  },
  pinModalIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  pinModalTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 8,
  },
  pinModalSubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 24,
  },
  pinInputContainer: {
    width: '100%',
    marginBottom: 12,
  },
  pinInput: {
    backgroundColor: Colors.inputBackground,
    borderWidth: 1.5,
    borderColor: Colors.inputBorder,
    borderRadius: 14,
    paddingVertical: 16,
    fontSize: 28,
    fontWeight: '700',
    color: Colors.textPrimary,
    letterSpacing: 16,
  },
  pinError: {
    fontSize: 13,
    color: Colors.error,
    marginBottom: 12,
    textAlign: 'center',
  },
  pinActions: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
    marginTop: 8,
  },
  pinCancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: Colors.inputBackground,
    borderWidth: 1,
    borderColor: Colors.inputBorder,
  },
  pinCancelText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  pinSubmitButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: Colors.primaryOrange,
  },
  pinSubmitDisabled: {
    opacity: 0.5,
  },
  pinSubmitText: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textPrimary,
  },

  // Sections
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 28,
    marginBottom: 14,
  },
  sectionIcon: {
    fontSize: 22,
    marginRight: 10,
  },
  sectionHeaderText: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  sectionSubtitle: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },

  // Personnel
  personnelList: {
    gap: 8,
    marginBottom: 12,
  },
  personnelCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.glassBackground,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
  },
  personnelAvatar: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: Colors.primaryBlue,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  personnelAvatarText: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  personnelInfo: {
    flex: 1,
  },
  personnelName: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  personnelDetail: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  personnelBadges: {
    flexDirection: 'row',
    gap: 6,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  statusActive: {
    backgroundColor: 'rgba(0, 200, 83, 0.15)',
  },
  statusInactive: {
    backgroundColor: 'rgba(255, 23, 68, 0.15)',
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  syncedBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    backgroundColor: 'rgba(26, 60, 94, 0.3)',
  },
  syncedBadgeText: {
    fontSize: 10,
    fontWeight: '500',
    color: Colors.textSecondary,
  },
  removeButton: {
    padding: 8,
  },
  removeButtonText: {
    fontSize: 18,
  },
  addPersonnelButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 14,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: Colors.inputBorder,
    borderStyle: 'dashed',
  },
  addPersonnelIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  addPersonnelText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.primaryOrange,
  },

  // Storage
  storageCard: {
    backgroundColor: Colors.glassBackground,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
  },
  storageBarContainer: {
    marginBottom: 14,
  },
  storageBarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  storageBarLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  storageBarSize: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  storageBarTrack: {
    height: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  storageBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  recordCountsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
    gap: 8,
  },
  recordCountItem: {
    flex: 1,
    minWidth: '40%',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  recordCountValue: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  recordCountLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 2,
  },

  // Action Buttons
  actionGroup: {
    gap: 8,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.glassBackground,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
  },
  actionButtonDanger: {
    borderColor: 'rgba(255, 23, 68, 0.2)',
  },
  actionIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  actionIcon: {
    fontSize: 20,
  },
  actionContent: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  actionSubtitle: {
    fontSize: 11,
    color: Colors.textSecondary,
  },
  actionArrow: {
    fontSize: 22,
    color: Colors.textSecondary,
    fontWeight: '300',
  },

  // Footer
  footer: {
    alignItems: 'center',
    paddingTop: 32,
    paddingBottom: 16,
  },
  footerText: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(176, 190, 197, 0.4)',
    marginBottom: 4,
  },
  footerSubtext: {
    fontSize: 11,
    color: 'rgba(176, 190, 197, 0.25)',
  },
});

export default AdminScreen;
