/**
 * @fileoverview SyncBanner Component
 * @description Renders a collapsible persistent banner reflecting the Datalake 3.0 synchronization state.
 * Employs animated transitions, showing outstanding queue item sizes and warning labels.
 *
 * @module components/SyncBanner
 * @version 1.0.0
 */

import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Platform } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withRepeat,
  withTiming,
  Easing,
  FadeIn,
} from 'react-native-reanimated';

const Colors = {
  primaryOrange: '#FF6B00',
  primaryBlue: '#1A3C5E',
  success: '#00C853',
  error: '#FF1744',
  warning: '#FFD600',
  textPrimary: '#FFFFFF',
  textSecondary: '#B0BEC5',
  glassBorder: 'rgba(255, 255, 255, 0.08)',
  glassBackground: 'rgba(27, 40, 56, 0.95)',
};

export interface SyncBannerProps {
  /** Count of outstanding local records waiting for upload */
  pendingCount: number;
  /** Synchronization action state */
  isSyncing: boolean;
  /** ISO-8601 string of last success sync */
  lastSyncTime: string | null;
  /** Sync error alert label (optional) */
  errorMsg?: string | null;
  /** Press handler to trigger sync dashboard navigate or action */
  onPress?: () => void;
}

export const SyncBanner: React.FC<SyncBannerProps> = ({
  pendingCount,
  isSyncing,
  lastSyncTime,
  errorMsg,
  onPress,
}) => {
  const [collapsed, setCollapsed] = useState(false);
  const rotation = useSharedValue(0);

  useEffect(() => {
    if (isSyncing) {
      // Endless rotation for sync icon
      rotation.value = withRepeat(
        withTiming(360, { duration: 1500, easing: Easing.linear }),
        -1,
        false,
      );
    } else {
      rotation.value = withTiming(0, { duration: 300 });
    }
  }, [isSyncing, rotation]);

  const animatedSyncIconStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  // Style selectors based on sync statuses
  const getBannerConfig = () => {
    if (errorMsg) {
      return { label: 'Sync Error', color: Colors.error, desc: errorMsg };
    }
    if (isSyncing) {
      return { label: 'Syncing Data...', color: Colors.primaryOrange, desc: 'Uploading files...' };
    }
    if (pendingCount > 0) {
      return {
        label: 'Local Backup Active',
        color: Colors.warning,
        desc: `${pendingCount} items offline`,
      };
    }
    return { label: 'All Synced', color: Colors.success, desc: 'Database is up-to-date' };
  };

  const config = getBannerConfig();

  if (collapsed) {
    return (
      <TouchableOpacity
        onPress={() => setCollapsed(false)}
        style={[styles.miniBanner, { borderLeftColor: config.color }]}
      >
        <Text style={styles.miniText}>🔄 Sync: {config.label}</Text>
      </TouchableOpacity>
    );
  }

  return (
    <Animated.View
      entering={FadeIn.duration(300)}
      style={[styles.banner, { borderLeftColor: config.color }]}
    >
      <TouchableOpacity activeOpacity={0.9} onPress={onPress} style={styles.contentContainer}>
        {/* Sync Icon */}
        <Animated.View style={[styles.syncIconContainer, animatedSyncIconStyle]}>
          <Text style={styles.icon}>🔄</Text>
        </Animated.View>

        <View style={styles.textContainer}>
          <Text style={styles.bannerTitle}>{config.label}</Text>
          <Text style={styles.bannerDesc} numberOfLines={1}>
            {config.desc}
          </Text>
        </View>

        {/* Sync Metadata */}
        {lastSyncTime && !errorMsg && !isSyncing ? (
          <Text style={styles.lastTimeText}>
            Last:{' '}
            {new Date(lastSyncTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
        ) : null}
      </TouchableOpacity>

      {/* Collapse Action Button */}
      <TouchableOpacity onPress={() => setCollapsed(true)} style={styles.closeButton}>
        <Text style={styles.closeText}>×</Text>
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  banner: {
    backgroundColor: Colors.glassBackground,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    borderLeftWidth: 4,
    borderRadius: 12,
    marginHorizontal: 16,
    marginVertical: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    ...Platform.select({
      android: { elevation: 3 },
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 6,
      },
    }),
  },
  contentContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  syncIconContainer: {
    marginRight: 12,
  },
  icon: {
    fontSize: 20,
  },
  textContainer: {
    flex: 1,
    marginRight: 8,
  },
  bannerTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  bannerDesc: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 1,
  },
  lastTimeText: {
    fontSize: 10,
    color: Colors.textSecondary,
    marginRight: 4,
  },
  closeButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginLeft: 4,
  },
  closeText: {
    fontSize: 20,
    color: Colors.textSecondary,
    fontWeight: '300',
  },
  miniBanner: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : 20,
    right: 16,
    backgroundColor: Colors.glassBackground,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    borderLeftWidth: 3,
    borderRadius: 14,
    paddingVertical: 6,
    paddingHorizontal: 12,
    ...Platform.select({
      android: { elevation: 4 },
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
      },
    }),
  },
  miniText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
});

export default SyncBanner;
