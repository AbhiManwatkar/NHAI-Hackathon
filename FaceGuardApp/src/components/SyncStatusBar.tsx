/**
 * FaceGuard Offline – SyncStatusBar Component
 * ==============================================
 *
 * A persistent status bar showing sync queue state, connectivity,
 * and last sync time. Animates between online/offline states.
 */

import React from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { Colors, Radii, Spacing, Typography } from '../theme';

interface SyncStatusBarProps {
  isOnline: boolean;
  queueSize: number;
  lastSyncTime?: string;
  isSyncing?: boolean;
}

export function SyncStatusBar({
  isOnline,
  queueSize,
  lastSyncTime,
  isSyncing = false,
}: SyncStatusBarProps) {
  const pulseAnim = React.useRef(new Animated.Value(1)).current;
  const slideAnim = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    if (isSyncing) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 0.4,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 600,
            useNativeDriver: true,
          }),
        ]),
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isSyncing, pulseAnim]);

  React.useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: 1,
      useNativeDriver: true,
      friction: 8,
    }).start();
  }, [slideAnim]);

  const formatTime = (iso?: string) => {
    if (!iso) return 'Never';
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <Animated.View
      style={[
        styles.container,
        {
          borderColor: isOnline ? Colors.accent[500] + '30' : Colors.warning[500] + '30',
          transform: [
            {
              translateY: slideAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [20, 0],
              }),
            },
          ],
          opacity: slideAnim,
        },
      ]}
    >
      {/* Connection indicator */}
      <View style={styles.leftSection}>
        <Animated.View
          style={[
            styles.statusDot,
            {
              backgroundColor: isOnline ? Colors.accent[400] : Colors.warning[500],
              opacity: isSyncing ? pulseAnim : 1,
            },
          ]}
        />
        <Text style={styles.statusText}>
          {isSyncing ? 'Syncing…' : isOnline ? 'Online' : 'Offline'}
        </Text>
      </View>

      {/* Queue count */}
      <View style={styles.centerSection}>
        <Text style={styles.queueLabel}>Queue</Text>
        <Text
          style={[
            styles.queueValue,
            { color: queueSize > 0 ? Colors.warning[400] : Colors.accent[400] },
          ]}
        >
          {queueSize}
        </Text>
      </View>

      {/* Last sync */}
      <View style={styles.rightSection}>
        <Text style={styles.syncLabel}>Last sync</Text>
        <Text style={styles.syncTime}>{formatTime(lastSyncTime)}</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.glass.light,
    borderWidth: 1,
    borderRadius: Radii.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    marginHorizontal: Spacing.lg,
  },
  leftSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  centerSection: {
    alignItems: 'center',
    flex: 1,
  },
  rightSection: {
    alignItems: 'flex-end',
    flex: 1,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: Spacing.xs,
  },
  statusText: {
    ...Typography.bodySmall,
    color: Colors.text.secondary,
    fontWeight: '600',
  },
  queueLabel: {
    ...Typography.labelSmall,
    color: Colors.text.tertiary,
  },
  queueValue: {
    fontSize: 16,
    fontWeight: '700',
    fontFamily: 'monospace',
  },
  syncLabel: {
    ...Typography.labelSmall,
    color: Colors.text.tertiary,
  },
  syncTime: {
    ...Typography.bodySmall,
    color: Colors.text.secondary,
    fontWeight: '500',
  },
});
