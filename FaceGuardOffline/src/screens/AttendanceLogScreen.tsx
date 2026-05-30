/**
 * @fileoverview AttendanceLogScreen - Attendance Records with Filtering
 * @description Displays a scrollable list of attendance records with date filtering,
 * search functionality, and pull-to-refresh. Each card shows personnel info,
 * face thumbnail, timestamp, confidence score, and sync status.
 *
 * All data is loaded from local encrypted storage.
 * @version 1.0.0
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  Platform,
  RefreshControl,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeInDown, FadeInUp, Layout } from 'react-native-reanimated';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AttendanceRecord, MainTabParamList, RootStackParamList } from '../types';

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

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
} as const;

/** Date filter presets */
type DateFilter = 'today' | 'week' | 'month' | 'all';

// ─────────────────────────────────────────────────────────────────────────────
// Navigation Typing
// ─────────────────────────────────────────────────────────────────────────────

type AttendanceLogScreenProps = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, 'AttendanceLog'>,
  NativeStackScreenProps<RootStackParamList>
>;

// ─────────────────────────────────────────────────────────────────────────────
// Mock Data
// ─────────────────────────────────────────────────────────────────────────────

/** Generate mock attendance records for development */
const generateMockRecords = (): AttendanceRecord[] => {
  const names = [
    'Rajesh Kumar',
    'Priya Sharma',
    'Amit Patel',
    'Sunita Devi',
    'Vikram Singh',
    'Anita Gupta',
    'Manoj Tiwari',
    'Kavita Joshi',
    'Sanjay Mehta',
    'Deepa Nair',
  ];
  const departments = ['Engineering', 'Operations', 'Toll Operations', 'Safety', 'Maintenance'];

  const now = Date.now();
  const records: AttendanceRecord[] = [];

  for (let i = 0; i < 25; i++) {
    const hoursAgo = i * 2.5 + Math.random() * 2;
    const timestamp = new Date(now - hoursAgo * 3600000);
    const personIdx = i % names.length;

    records.push({
      id: `att-${String(i + 1).padStart(3, '0')}`,
      personnelId: `p-${String(personIdx + 1).padStart(3, '0')}`,
      personnelName: names[personIdx],
      capturedPhoto: '',
      confidence: 0.85 + Math.random() * 0.14,
      livenessScore: 0.9 + Math.random() * 0.09,
      method: 'face_recognition',
      location:
        Math.random() > 0.3
          ? {
              latitude: 28.6139 + (Math.random() - 0.5) * 0.01,
              longitude: 77.209 + (Math.random() - 0.5) * 0.01,
              accuracy: 5 + Math.random() * 15,
            }
          : null,
      deviceId: 'DEV-001',
      timestamp: timestamp.toISOString(),
      isSynced: Math.random() > 0.3,
      lastSyncAttempt: Math.random() > 0.5 ? new Date(now - 1800000).toISOString() : null,
      syncAttempts: Math.floor(Math.random() * 3),
    });
  }

  return records;
};

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Search bar with icon
 */
const SearchBar: React.FC<{
  value: string;
  onChangeText: (text: string) => void;
}> = ({ value, onChangeText }) => (
  <View style={styles.searchContainer}>
    <Text style={styles.searchIcon}>🔍</Text>
    <TextInput
      style={styles.searchInput}
      value={value}
      onChangeText={onChangeText}
      placeholder="Search by name or ID..."
      placeholderTextColor="rgba(176, 190, 197, 0.4)"
      selectionColor={Colors.primaryOrange}
      autoCorrect={false}
    />
    {value.length > 0 && (
      <TouchableOpacity
        onPress={() => onChangeText('')}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Text style={styles.clearIcon}>✕</Text>
      </TouchableOpacity>
    )}
  </View>
);

/**
 * Date filter chip bar
 */
const DateFilterBar: React.FC<{
  activeFilter: DateFilter;
  onFilterChange: (filter: DateFilter) => void;
  totalCount: number;
}> = ({ activeFilter, onFilterChange, totalCount }) => {
  const filters: { key: DateFilter; label: string }[] = [
    { key: 'today', label: 'Today' },
    { key: 'week', label: 'This Week' },
    { key: 'month', label: 'This Month' },
    { key: 'all', label: 'All' },
  ];

  return (
    <View style={styles.filterBarContainer}>
      <View style={styles.filterChips}>
        {filters.map((filter) => (
          <TouchableOpacity
            key={filter.key}
            style={[styles.filterChip, activeFilter === filter.key && styles.filterChipActive]}
            onPress={() => onFilterChange(filter.key)}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.filterChipText,
                activeFilter === filter.key && styles.filterChipTextActive,
              ]}
            >
              {filter.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      <Text style={styles.recordCount}>{totalCount} records</Text>
    </View>
  );
};

/**
 * Individual attendance record card
 */
const AttendanceCard: React.FC<{
  record: AttendanceRecord;
  index: number;
}> = React.memo(({ record, index }) => {
  /**
   * Format timestamp to locale display string
   */
  const formattedTime = useMemo(() => {
    const date = new Date(record.timestamp);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();

    const timeStr = date.toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });

    if (isToday) {
      return `Today, ${timeStr}`;
    }

    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) {
      return `Yesterday, ${timeStr}`;
    }

    return `${date.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
    })}, ${timeStr}`;
  }, [record.timestamp]);

  const confidencePercent = Math.round(record.confidence * 100);
  const livenessPercent = Math.round(record.livenessScore * 100);

  /** Get confidence badge color based on score */
  const confidenceColor =
    confidencePercent >= 95
      ? Colors.success
      : confidencePercent >= 85
      ? Colors.primaryOrange
      : Colors.warning;

  return (
    <Animated.View
      entering={FadeInDown.delay(index * 50)
        .duration(300)
        .springify()
        .damping(18)}
      layout={Layout.springify().damping(18)}
    >
      <TouchableOpacity style={styles.attendanceCard} activeOpacity={0.8}>
        {/* Left: Avatar */}
        <View style={styles.cardAvatar}>
          <Text style={styles.cardAvatarText}>{record.personnelName.charAt(0).toUpperCase()}</Text>
        </View>

        {/* Center: Details */}
        <View style={styles.cardContent}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardName} numberOfLines={1}>
              {record.personnelName}
            </Text>
            {/* Sync status icon */}
            <View
              style={[
                styles.syncBadge,
                record.isSynced ? styles.syncBadgeSynced : styles.syncBadgePending,
              ]}
            >
              <Text style={styles.syncBadgeText}>{record.isSynced ? '☁️' : '⏳'}</Text>
            </View>
          </View>

          <Text style={styles.cardTimestamp}>{formattedTime}</Text>

          {/* Metrics row */}
          <View style={styles.cardMetrics}>
            <View style={styles.metricItem}>
              <View style={[styles.metricDot, { backgroundColor: confidenceColor }]} />
              <Text style={styles.metricText}>{confidencePercent}% match</Text>
            </View>
            <View style={styles.metricItem}>
              <View
                style={[
                  styles.metricDot,
                  {
                    backgroundColor: livenessPercent >= 90 ? Colors.success : Colors.warning,
                  },
                ]}
              />
              <Text style={styles.metricText}>{livenessPercent}% live</Text>
            </View>
            {record.location && (
              <View style={styles.metricItem}>
                <Text style={styles.metricLocationIcon}>📍</Text>
                <Text style={styles.metricText}>GPS</Text>
              </View>
            )}
          </View>
        </View>

        {/* Right: Confidence Score */}
        <View style={styles.cardScoreContainer}>
          <Text style={[styles.cardScore, { color: confidenceColor }]}>{confidencePercent}</Text>
          <Text style={styles.cardScoreLabel}>%</Text>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
});

AttendanceCard.displayName = 'AttendanceCard';

/**
 * Empty state component
 */
const EmptyState: React.FC<{ searchQuery: string }> = ({ searchQuery }) => (
  <Animated.View entering={FadeInUp.duration(400)} style={styles.emptyState}>
    <Text style={styles.emptyStateIcon}>{searchQuery ? '🔍' : '📋'}</Text>
    <Text style={styles.emptyStateTitle}>
      {searchQuery ? 'No Results Found' : 'No Attendance Records'}
    </Text>
    <Text style={styles.emptyStateSubtitle}>
      {searchQuery
        ? `No records match "${searchQuery}"`
        : 'Attendance records will appear here after face recognition'}
    </Text>
  </Animated.View>
);

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────

/**
 * AttendanceLogScreen - Browsable, filterable attendance log
 *
 * Features:
 * - Scrollable FlatList with attendance cards
 * - Date filter presets (Today, Week, Month, All)
 * - Full-text search by personnel name or ID
 * - Pull-to-refresh to reload from local DB
 * - Sync status indicator per record
 * - Confidence and liveness score badges
 */
const AttendanceLogScreen: React.FC<AttendanceLogScreenProps> = () => {
  // ── State ──────────────────────────────────────────────────────────────
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [dateFilter, setDateFilter] = useState<DateFilter>('today');

  // ── Data Loading ───────────────────────────────────────────────────────

  const loadRecords = useCallback(async () => {
    try {
      // TODO: Replace with actual DB query
      // const records = await AttendanceDB.query({ dateFilter, searchQuery });
      const mockRecords = generateMockRecords();
      setRecords(mockRecords);
    } catch (error) {
      console.error('[AttendanceLogScreen] Failed to load records:', error);
    }
  }, []);

  useEffect(() => {
    loadRecords();
  }, [loadRecords]);

  // ── Filtering ──────────────────────────────────────────────────────────

  const filteredRecords = useMemo(() => {
    let filtered = [...records];

    // Apply date filter
    const now = new Date();
    switch (dateFilter) {
      case 'today': {
        const startOfDay = new Date(now);
        startOfDay.setHours(0, 0, 0, 0);
        filtered = filtered.filter((r) => new Date(r.timestamp) >= startOfDay);
        break;
      }
      case 'week': {
        const weekAgo = new Date(now.getTime() - 7 * 24 * 3600000);
        filtered = filtered.filter((r) => new Date(r.timestamp) >= weekAgo);
        break;
      }
      case 'month': {
        const monthAgo = new Date(now.getTime() - 30 * 24 * 3600000);
        filtered = filtered.filter((r) => new Date(r.timestamp) >= monthAgo);
        break;
      }
      case 'all':
      default:
        break;
    }

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (r) =>
          r.personnelName.toLowerCase().includes(query) ||
          r.personnelId.toLowerCase().includes(query),
      );
    }

    // Sort by timestamp descending
    filtered.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return filtered;
  }, [records, dateFilter, searchQuery]);

  // ── Handlers ───────────────────────────────────────────────────────────

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await loadRecords();
    setIsRefreshing(false);
  }, [loadRecords]);

  const handleFilterChange = useCallback((filter: DateFilter) => {
    setDateFilter(filter);
  }, []);

  // ── Render ─────────────────────────────────────────────────────────────

  const renderItem = useCallback(
    ({ item, index }: { item: AttendanceRecord; index: number }) => (
      <AttendanceCard record={item} index={index} />
    ),
    [],
  );

  const keyExtractor = useCallback((item: AttendanceRecord) => item.id, []);

  const renderHeader = useCallback(
    () => (
      <View>
        {/* Summary Stats */}
        <View style={styles.summaryRow}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryValue}>{filteredRecords.length}</Text>
            <Text style={styles.summaryLabel}>Total</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={[styles.summaryValue, { color: Colors.success }]}>
              {filteredRecords.filter((r) => r.isSynced).length}
            </Text>
            <Text style={styles.summaryLabel}>Synced</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={[styles.summaryValue, { color: Colors.warning }]}>
              {filteredRecords.filter((r) => !r.isSynced).length}
            </Text>
            <Text style={styles.summaryLabel}>Pending</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={[styles.summaryValue, { color: Colors.primaryOrange }]}>
              {filteredRecords.length > 0
                ? `${Math.round(
                    (filteredRecords.reduce((sum, r) => sum + r.confidence, 0) /
                      filteredRecords.length) *
                      100,
                  )}%`
                : '—'}
            </Text>
            <Text style={styles.summaryLabel}>Avg Match</Text>
          </View>
        </View>
      </View>
    ),
    [filteredRecords],
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.backgroundDark} />

      {/* Screen Header */}
      <View style={styles.screenHeader}>
        <Text style={styles.screenTitle}>Attendance Log</Text>
        <TouchableOpacity style={styles.exportButton} activeOpacity={0.7}>
          <Text style={styles.exportButtonText}>📤 Export</Text>
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
      <SearchBar value={searchQuery} onChangeText={setSearchQuery} />

      {/* Date Filters */}
      <DateFilterBar
        activeFilter={dateFilter}
        onFilterChange={handleFilterChange}
        totalCount={filteredRecords.length}
      />

      {/* Attendance List */}
      <FlatList
        data={filteredRecords}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={<EmptyState searchQuery={searchQuery} />}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={Colors.primaryOrange}
            colors={[Colors.primaryOrange]}
            progressBackgroundColor={Colors.surface}
          />
        }
        initialNumToRender={10}
        maxToRenderPerBatch={10}
        windowSize={7}
        getItemLayout={(_, index) => ({
          length: 100,
          offset: 100 * index,
          index,
        })}
      />
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

  // Screen Header
  screenHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
  },
  screenTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: Colors.textPrimary,
    letterSpacing: 0.3,
  },
  exportButton: {
    backgroundColor: Colors.surface,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
  },
  exportButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
  },

  // Search
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.inputBackground,
    borderRadius: 14,
    marginHorizontal: 20,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: Colors.inputBorder,
    marginBottom: 12,
  },
  searchIcon: {
    fontSize: 16,
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: Colors.textPrimary,
    paddingVertical: Platform.OS === 'ios' ? 12 : 10,
    fontWeight: '500',
  },
  clearIcon: {
    fontSize: 14,
    color: Colors.textSecondary,
    padding: 4,
  },

  // Date Filters
  filterBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  filterChips: {
    flexDirection: 'row',
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 18,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.inputBorder,
  },
  filterChipActive: {
    backgroundColor: 'rgba(255, 107, 0, 0.2)',
    borderColor: Colors.primaryOrange,
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  filterChipTextActive: {
    color: Colors.primaryOrange,
  },
  recordCount: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: '500',
  },

  // Summary Stats
  summaryRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: Colors.glassBackground,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.glassBorder,
  },
  summaryValue: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  summaryLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // List
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 100,
  },

  // Attendance Card
  attendanceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.glassBackground,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    ...Platform.select({
      android: { elevation: 1 },
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
    }),
  },
  cardAvatar: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: Colors.primaryBlue,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  cardAvatarText: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  cardContent: {
    flex: 1,
    marginRight: 8,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 3,
  },
  cardName: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  syncBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  syncBadgeSynced: {
    backgroundColor: 'rgba(0, 200, 83, 0.15)',
  },
  syncBadgePending: {
    backgroundColor: 'rgba(255, 214, 0, 0.15)',
  },
  syncBadgeText: {
    fontSize: 10,
  },
  cardTimestamp: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginBottom: 6,
  },
  cardMetrics: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  metricItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metricDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 4,
  },
  metricText: {
    fontSize: 11,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  metricLocationIcon: {
    fontSize: 10,
    marginRight: 2,
  },
  cardScoreContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 44,
  },
  cardScore: {
    fontSize: 22,
    fontWeight: '800',
  },
  cardScoreLabel: {
    fontSize: 10,
    color: Colors.textSecondary,
    fontWeight: '600',
  },

  // Empty State
  emptyState: {
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 40,
  },
  emptyStateIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 8,
  },
  emptyStateSubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
});

export default AttendanceLogScreen;
