/**
 * FaceGuard Offline – GlassCard Component
 * ==========================================
 *
 * A glassmorphism-styled card with frosted background, subtle borders,
 * and optional glow effect. Used as the primary surface component
 * throughout the FaceGuard UI.
 */

import React from 'react';
import { View, StyleSheet, ViewStyle, Pressable, Animated } from 'react-native';
import { Colors, Radii, Shadows, Spacing } from '../theme';

interface GlassCardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  glowColor?: string;
  onPress?: () => void;
  variant?: 'default' | 'elevated' | 'highlight';
}

export function GlassCard({
  children,
  style,
  glowColor,
  onPress,
  variant = 'default',
}: GlassCardProps) {
  const scaleAnim = React.useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.97,
      useNativeDriver: true,
      friction: 8,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      friction: 5,
    }).start();
  };

  const variantStyles: Record<string, ViewStyle> = {
    default: {
      backgroundColor: Colors.glass.light,
      borderColor: Colors.border.subtle,
    },
    elevated: {
      backgroundColor: Colors.glass.medium,
      borderColor: Colors.border.default,
      ...Shadows.md,
    },
    highlight: {
      backgroundColor: Colors.glass.strong,
      borderColor: Colors.primary[600],
      ...Shadows.md,
    },
  };

  const glowStyle = glowColor ? Shadows.glow(glowColor) : {};

  const content = (
    <Animated.View
      style={[
        styles.card,
        variantStyles[variant],
        glowStyle,
        { transform: [{ scale: scaleAnim }] },
        style,
      ]}
    >
      {children}
    </Animated.View>
  );

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
      >
        {content}
      </Pressable>
    );
  }

  return content;
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radii.lg,
    borderWidth: 1,
    padding: Spacing.lg,
    overflow: 'hidden',
  },
});
