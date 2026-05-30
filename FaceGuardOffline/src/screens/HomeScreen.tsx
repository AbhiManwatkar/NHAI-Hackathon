/**
 * @fileoverview HomeScreen - FaceGuard Offline Dashboard
 * @description Main dashboard featuring glassmorphism-styled stat cards,
 * animated gradient header with NHAI branding, quick action buttons for
 * enrollment and recognition, and real-time sync status indicators.
 * All data is sourced from local storage for offline operation.
 * @version 1.0.0
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Dimensions,
  Platform,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import Animated, {
  Easing,
  FadeInDown,
  FadeInUp,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { DashboardStats, MainTabParamList, RootStackParamList, SyncStatus } from '../types';

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_MARGIN = 12;
const CARD_WIDTH = (SCREEN_WIDTH - CARD_MARGIN * 3) / 2;

/** NHAI Brand Colors */
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
  cardGlow: 'rgba(255, 107, 0, 0.15)',
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Navigation Typing
// ─────────────────────────────────────────────────────────────────────────────

type HomeScreenProps = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, 'Home'>,
  NativeStackScreenProps<RootStackParamList>
>;

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Animated pulsing sync indicator dot
 * @param props.isConnected - Whether the device is currently connected
 */
const SyncIndicator: React.FC<{ isConnected: boolean }> = ({ isConnected }) => {
  const pulseAnim = useSharedValue(1);

  useEffect(() => {
    if (isConnected) {
      pulseAnim.value = withRepeat(
        withSequence(
          withTiming(1.3, { duration: 800, easing: Easing.inOut(Easing.ease) }),
          withTiming(1, { duration: 800, easing: Easing.inOut(Easing.ease) }),
        ),
        -1,
        false,
      );
    } else {
      pulseAnim.value = withTiming(1, { duration: 300 });
    }
  }, [isConnected, pulseAnim]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseAnim.value }],
  }));

  return (
    <View style={styles.syncIndicatorContainer}>
      <Animated.View
        style={[
          styles.syncDot,
          { backgroundColor: isConnected ? Colors.success : Colors.error },
          animatedStyle,
        ]}
      />
      <Text style={styles.syncLabel}>{isConnected ? 'Online' : 'Offline'}</Text>
    </View>
  );
};

/**
 * Glassmorphism-styled statistics card with animated entrance
 * @param props.title - Card title label
 * @param props.value - Display value (count or status text)
 * @param props.subtitle - Secondary text below the value
 * @param props.icon - Emoji/text icon placeholder
 * @param props.accentColor - Left border accent color
 * @param props.index - Card index for staggered animation
 */
const StatCard: React.FC<{
  title: string;
  value: string | number;
  subtitle: string;
  icon: string;
  accentColor: string;
  index: number;
}> = ({ title, value, subtitle, icon, accentColor, index }) => {
  return (
    <Animated.View
      entering={FadeInDown.delay(200 + index * 100)
        .duration(500)
        .springify()
        .damping(15)}
      style={[styles.statCard, { borderLeftColor: accentColor }]}
    >
      <View style={styles.statCardInner}>
        <View style={styles.statIconContainer}>
          <Text style={styles.statIcon}>{icon}</Text>
        </View>
        <Text style={styles.statTitle}>{title}</Text>
        <Text style={[styles.statValue, { color: accentColor }]}>{value}</Text>
        <Text style={styles.statSubtitle}>{subtitle}</Text>
      </View>
    </Animated.View>
  );
};

/**
 * Quick action button with gradient background
 * @param props.title - Button label
 * @param props.subtitle - Button description
 * @param props.icon - Emoji/text icon placeholder
 * @param props.gradientColors - LinearGradient color stops
 * @param props.onPress - Press handler
 * @param props.index - Button index for staggered animation
 */
const ActionButton: React.FC<{
  title: string;
  subtitle: string;
  icon: string;
  gradientColors: string[];
  onPress: () => void;
  index: number;
}> = ({ title, subtitle, icon, gradientColors, onPress, index }) => {
  const scaleAnim = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scaleAnim.value }],
  }));

  const handlePressIn = useCallback(() => {
    scaleAnim.value = withSpring(0.95, { damping: 15, stiffness: 200 });
  }, [scaleAnim]);

  const handlePressOut = useCallback(() => {
    scaleAnim.value = withSpring(1, { damping: 15, stiffness: 200 });
  }, [scaleAnim]);

  return (
    <Animated.View
      entering={FadeInDown.delay(500 + index * 150)
        .duration(500)
        .springify()
        .damping(15)}
    >
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
      >
        <Animated.View style={animatedStyle}>
          <LinearGradient
            colors={gradientColors}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.actionButton}
          >
            <Text style={styles.actionIcon}>{icon}</Text>
            <View style={styles.actionTextContainer}>
              <Text style={styles.actionTitle}>{title}</Text>
              <Text style={styles.actionSubtitle}>{subtitle}</Text>
            </View>
            <Text style={styles.actionArrow}>›</Text>
          </LinearGradient>
        </Animated.View>
      </TouchableOpacity>
    </Animated.View>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────

/**
 * HomeScreen - Main dashboard for FaceGuard Offline
 *
 * Displays:
 * - Animated gradient header with NHAI branding and sync status
 * - Glassmorphism stat cards: enrolled count, attendance, sync status
 * - Quick action buttons for enrollment and recognition
 * - Pull-to-refresh for data reload
 *
 * All data is loaded from local SQLite/encrypted storage.
 */
const HomeScreen: React.FC<HomeScreenProps> = ({ navigation }) => {
  // ── State ──────────────────────────────────────────────────────────────
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [dashboardStats, setDashboardStats] = useState<DashboardStats>({
    totalEnrolled: 0,
    todayAttendance: 0,
    syncStatus: {
      isConnected: false,
      isSyncing: false,
      pendingCount: 0,
      failedCount: 0,
      completedCount: 0,
      lastSuccessfulSync: null,
      progress: 0,
      currentError: null,
      uploadSpeedBps: 0,
    },
    lastSyncTime: null,
  });

  // ── Animations ─────────────────────────────────────────────────────────
  const headerAnim = useSharedValue(0);

  useEffect(() => {
    headerAnim.value = withTiming(1, {
      duration: 1000,
      easing: Easing.out(Easing.cubic),
    });
  }, [headerAnim]);

  const headerAnimatedStyle = useAnimatedStyle(() => ({
    opacity: headerAnim.value,
    transform: [
      {
        translateY: interpolate(headerAnim.value, [0, 1], [-30, 0]),
      },
    ],
  }));

  // ── Data Loading ───────────────────────────────────────────────────────

  /**
   * Loads dashboard statistics from local storage.
   * In production, this would query SQLite and the sync engine.
   */
  const loadDashboardData = useCallback(async (): Promise<void> => {
    try {
      // TODO: Replace with actual data layer calls
      // const personnelCount = await PersonnelDB.getActiveCount();
      // const todayAttendance = await AttendanceDB.getTodayCount();
      // const syncStatus = await SyncEngine.getStatus();
      setDashboardStats({
        totalEnrolled: 24,
        todayAttendance: 18,
        syncStatus: {
          isConnected: false,
          isSyncing: false,
          pendingCount: 3,
          failedCount: 0,
          completedCount: 42,
          lastSuccessfulSync: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
          progress: 0,
          currentError: null,
          uploadSpeedBps: 0,
        },
        lastSyncTime: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      });
    } catch (error) {
      console.error('[HomeScreen] Failed to load dashboard data:', error);
    }
  }, []);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  // ── Handlers ───────────────────────────────────────────────────────────

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await loadDashboardData();
    setIsRefreshing(false);
  }, [loadDashboardData]);

  const navigateToEnrolment = useCallback(() => {
    navigation.navigate('Enrolment');
  }, [navigation]);

  const navigateToRecognition = useCallback(() => {
    navigation.navigate('Recognition');
  }, [navigation]);

  const navigateToSyncStatus = useCallback(() => {
    navigation.navigate('SyncStatus');
  }, [navigation]);

  // ── Helpers ────────────────────────────────────────────────────────────

  /**
   * Formats an ISO timestamp into a human-readable relative time string.
   * @param isoTimestamp - ISO 8601 timestamp string
   * @returns Formatted relative time (e.g., "2h ago", "Just now")
   */
  const formatRelativeTime = (isoTimestamp: string | null): string => {
    if (!isoTimestamp) {
      return 'Never';
    }
    const diff = Date.now() - new Date(isoTimestamp).getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) {
      return 'Just now';
    }
    if (minutes < 60) {
      return `${minutes}m ago`;
    }
    const hours = Math.floor(minutes / 60);
    if (hours < 24) {
      return `${hours}h ago`;
    }
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  /**
   * Returns a sync status display string based on current state
   */
  const getSyncStatusText = (syncStatus: SyncStatus): string => {
    if (syncStatus.isSyncing) {
      return 'Syncing...';
    }
    if (syncStatus.pendingCount > 0) {
      return `${syncStatus.pendingCount} Pending`;
    }
    if (syncStatus.failedCount > 0) {
      return `${syncStatus.failedCount} Failed`;
    }
    return 'Up to date';
  };

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar
        barStyle="light-content"
        backgroundColor={Colors.backgroundDark}
        translucent={false}
      />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={Colors.primaryOrange}
            colors={[Colors.primaryOrange]}
            progressBackgroundColor={Colors.surface}
          />
        }
      >
        {/* ── Animated Gradient Header ─────────────────────────────────── */}
        <Animated.View style={headerAnimatedStyle}>
          <LinearGradient
            colors={[Colors.primaryBlue, Colors.backgroundDark]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.header}
          >
            <View style={styles.headerTop}>
              <View style={styles.logoArea}>
                <View style={styles.logoPlaceholder}>
                  <Text style={styles.logoText}>NHAI</Text>
                </View>
                <View style={styles.headerTitleContainer}>
                  <Text style={styles.headerTitle}>FaceGuard</Text>
                  <Text style={styles.headerSubtitle}>Offline Authentication System</Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={navigateToSyncStatus}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <SyncIndicator isConnected={dashboardStats.syncStatus.isConnected} />
              </TouchableOpacity>
            </View>

            <View style={styles.headerGreeting}>
              <Text style={styles.greetingText}>{getGreeting()}, Officer</Text>
              <Text style={styles.dateText}>
                {new Date().toLocaleDateString('en-IN', {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}
              </Text>
            </View>
          </LinearGradient>
        </Animated.View>

        {/* ── Statistics Cards ─────────────────────────────────────────── */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Dashboard Overview</Text>
        </View>

        <View style={styles.statsGrid}>
          <StatCard
            title="Enrolled"
            value={dashboardStats.totalEnrolled}
            subtitle="Total Personnel"
            icon="👥"
            accentColor={Colors.primaryOrange}
            index={0}
          />
          <StatCard
            title="Today"
            value={dashboardStats.todayAttendance}
            subtitle="Attendance"
            icon="📋"
            accentColor={Colors.success}
            index={1}
          />
          <StatCard
            title="Sync"
            value={getSyncStatusText(dashboardStats.syncStatus)}
            subtitle={`Last: ${formatRelativeTime(dashboardStats.lastSyncTime)}`}
            icon="🔄"
            accentColor={
              dashboardStats.syncStatus.pendingCount > 0 ? Colors.warning : Colors.success
            }
            index={2}
          />
          <StatCard
            title="Accuracy"
            value="98.5%"
            subtitle="Match Rate"
            icon="🎯"
            accentColor={Colors.primaryBlue}
            index={3}
          />
        </View>

        {/* ── Quick Actions ───────────────────────────────────────────── */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
        </View>

        <View style={styles.actionsContainer}>
          <ActionButton
            title="New Enrolment"
            subtitle="Register new personnel with face capture"
            icon="📸"
            gradientColors={[Colors.primaryOrange, '#FF8F00']}
            onPress={navigateToEnrolment}
            index={0}
          />
          <ActionButton
            title="Face Recognition"
            subtitle="Authenticate and record attendance"
            icon="🔍"
            gradientColors={[Colors.primaryBlue, '#2A5A8E']}
            onPress={navigateToRecognition}
            index={1}
          />
          <ActionButton
            title="Sync Status"
            subtitle={`${dashboardStats.syncStatus.pendingCount} items pending sync`}
            icon="☁️"
            gradientColors={['#1B3A4B', '#2A5A6E']}
            onPress={navigateToSyncStatus}
            index={2}
          />
        </View>

        {/* ── Recent Activity Placeholder ─────────────────────────────── */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent Activity</Text>
          <TouchableOpacity>
            <Text style={styles.seeAllText}>See All</Text>
          </TouchableOpacity>
        </View>

        <Animated.View
          entering={FadeInUp.delay(800).duration(400)}
          style={styles.recentActivityCard}
        >
          <Text style={styles.emptyStateIcon}>📝</Text>
          <Text style={styles.emptyStateText}>Recent attendance records will appear here</Text>
          <Text style={styles.emptyStateSubtext}>
            Use Face Recognition to start recording attendance
          </Text>
        </Animated.View>

        {/* Bottom spacing */}
        <View style={styles.bottomSpacer} />
      </ScrollView>
    </SafeAreaView>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Helper Functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns a time-appropriate greeting string.
 * @returns Greeting text based on current hour
 */
function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) {
    return 'Good Morning';
  }
  if (hour < 17) {
    return 'Good Afternoon';
  }
  return 'Good Evening';
}

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
    paddingBottom: 20,
  },

  // Header
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 24,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  logoArea: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: Colors.primaryOrange,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    ...Platform.select({
      android: { elevation: 4 },
      ios: {
        shadowColor: Colors.primaryOrange,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.4,
        shadowRadius: 4,
      },
    }),
  },
  logoText: {
    fontSize: 12,
    fontWeight: '900',
    color: Colors.textPrimary,
    letterSpacing: 1,
  },
  headerTitleContainer: {
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.textPrimary,
    letterSpacing: 0.5,
  },
  headerSubtitle: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 2,
    letterSpacing: 0.3,
  },
  headerGreeting: {
    marginTop: 4,
  },
  greetingText: {
    fontSize: 26,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  dateText: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginTop: 4,
  },

  // Sync Indicator
  syncIndicatorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  syncDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  syncLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textSecondary,
  },

  // Section Headers
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginTop: 24,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
    letterSpacing: 0.3,
  },
  seeAllText: {
    fontSize: 14,
    color: Colors.primaryOrange,
    fontWeight: '600',
  },

  // Statistics Grid
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: CARD_MARGIN,
    gap: CARD_MARGIN,
  },
  statCard: {
    width: CARD_WIDTH,
    backgroundColor: Colors.glassBackground,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    borderLeftWidth: 3,
    overflow: 'hidden',
    ...Platform.select({
      android: { elevation: 2 },
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
      },
    }),
  },
  statCardInner: {
    padding: 16,
  },
  statIconContainer: {
    marginBottom: 8,
  },
  statIcon: {
    fontSize: 24,
  },
  statTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  statValue: {
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 4,
  },
  statSubtitle: {
    fontSize: 11,
    color: Colors.textSecondary,
  },

  // Action Buttons
  actionsContainer: {
    paddingHorizontal: 20,
    gap: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 18,
    paddingHorizontal: 20,
    borderRadius: 16,
    ...Platform.select({
      android: { elevation: 4 },
      ios: {
        shadowColor: Colors.primaryOrange,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
      },
    }),
  },
  actionIcon: {
    fontSize: 28,
    marginRight: 16,
  },
  actionTextContainer: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  actionSubtitle: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.75)',
  },
  actionArrow: {
    fontSize: 28,
    color: 'rgba(255, 255, 255, 0.6)',
    fontWeight: '300',
  },

  // Recent Activity
  recentActivityCard: {
    marginHorizontal: 20,
    backgroundColor: Colors.glassBackground,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    paddingVertical: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyStateIcon: {
    fontSize: 36,
    marginBottom: 12,
  },
  emptyStateText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  emptyStateSubtext: {
    fontSize: 12,
    color: 'rgba(176, 190, 197, 0.6)',
    textAlign: 'center',
    paddingHorizontal: 40,
  },

  // Spacing
  bottomSpacer: {
    height: 100,
  },
});

export default HomeScreen;
