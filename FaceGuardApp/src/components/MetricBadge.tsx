/**
 * FaceGuard Offline – MetricBadge Component
 * ============================================
 *
 * Displays a numerical metric with a label, styled as a compact badge.
 * Used in admin dashboards, benchmark results, and sync status panels.
 */

import React from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { Colors, Radii, Spacing, Typography } from '../theme';

interface MetricBadgeProps {
  label: string;
  value: string | number;
  unit?: string;
  color?: string;
  size?: 'sm' | 'md' | 'lg';
  animated?: boolean;
}

export function MetricBadge({
  label,
  value,
  unit,
  color = Colors.primary[400],
  size = 'md',
  animated = false,
}: MetricBadgeProps) {
  const pulseAnim = React.useRef(new Animated.Value(1)).current;

  React.useEffect(() => {
    if (animated) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.05,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ]),
      ).start();
    }
  }, [animated, pulseAnim]);

  const sizes = {
    sm: { value: 20, label: 10, padding: Spacing.sm },
    md: { value: 28, label: 11, padding: Spacing.md },
    lg: { value: 36, label: 12, padding: Spacing.lg },
  };
  const s = sizes[size];

  return (
    <Animated.View
      style={[
        styles.container,
        {
          padding: s.padding,
          borderColor: color + '30',
          transform: [{ scale: animated ? pulseAnim : 1 }],
        },
      ]}
    >
      <View style={styles.valueRow}>
        <Text style={[styles.value, { fontSize: s.value, color }]}>
          {value}
        </Text>
        {unit && (
          <Text style={[styles.unit, { color: color + '99' }]}>{unit}</Text>
        )}
      </View>
      <Text style={[styles.label, { fontSize: s.label }]}>{label}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    borderRadius: Radii.md,
    borderWidth: 1,
    backgroundColor: Colors.glass.light,
    minWidth: 80,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  value: {
    fontWeight: '700',
    fontFamily: 'monospace',
  },
  unit: {
    fontSize: 12,
    fontWeight: '500',
    marginLeft: 2,
  },
  label: {
    color: Colors.text.tertiary,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginTop: 4,
  },
});
