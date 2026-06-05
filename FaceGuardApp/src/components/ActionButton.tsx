/**
 * FaceGuard Offline – ActionButton Component
 * =============================================
 *
 * A premium animated button with gradient fill, glow effect on press,
 * and loading state support. Used for all primary CTAs.
 */

import React from 'react';
import {
  Pressable,
  Text,
  StyleSheet,
  Animated,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { Colors, Radii, Spacing, Typography, Shadows } from '../theme';

interface ActionButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'accent' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
  style?: ViewStyle;
}

const VARIANT_COLORS = {
  primary: { bg: Colors.primary[500], text: '#FFFFFF', glow: Colors.primary[500] },
  accent:  { bg: Colors.accent[500],  text: Colors.text.inverse, glow: Colors.accent[500] },
  danger:  { bg: Colors.danger[500],  text: '#FFFFFF', glow: Colors.danger[500] },
  ghost:   { bg: 'transparent',       text: Colors.text.primary, glow: 'transparent' },
};

const SIZE_STYLES: Record<string, { height: number; paddingH: number; text: TextStyle }> = {
  sm: { height: 40, paddingH: Spacing.md, text: { fontSize: 13, fontWeight: '600' } },
  md: { height: 52, paddingH: Spacing.xl, text: { fontSize: 15, fontWeight: '600' } },
  lg: { height: 60, paddingH: Spacing.xxl, text: { fontSize: 17, fontWeight: '700' } },
};

export function ActionButton({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  icon,
  style,
}: ActionButtonProps) {
  const scaleAnim = React.useRef(new Animated.Value(1)).current;
  const glowAnim = React.useRef(new Animated.Value(0)).current;

  const handlePressIn = () => {
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 0.95,
        useNativeDriver: true,
        friction: 8,
      }),
      Animated.timing(glowAnim, {
        toValue: 1,
        duration: 150,
        useNativeDriver: false,
      }),
    ]).start();
  };

  const handlePressOut = () => {
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 1,
        useNativeDriver: true,
        friction: 5,
      }),
      Animated.timing(glowAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: false,
      }),
    ]).start();
  };

  const colors = VARIANT_COLORS[variant];
  const sizeStyle = SIZE_STYLES[size];
  const isGhost = variant === 'ghost';

  return (
    <Pressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled || loading}
    >
      <Animated.View
        style={[
          styles.button,
          {
            backgroundColor: disabled ? Colors.border.default : colors.bg,
            height: sizeStyle.height,
            paddingHorizontal: sizeStyle.paddingH,
            borderWidth: isGhost ? 1.5 : 0,
            borderColor: isGhost ? Colors.border.default : 'transparent',
            opacity: disabled ? 0.5 : 1,
            transform: [{ scale: scaleAnim }],
          },
          !isGhost && !disabled && Shadows.glow(colors.glow),
          style,
        ]}
      >
        {loading ? (
          <ActivityIndicator color={colors.text} size="small" />
        ) : (
          <>
            {icon}
            <Text
              style={[
                styles.text,
                sizeStyle.text,
                { color: disabled ? Colors.text.tertiary : colors.text },
                icon ? { marginLeft: Spacing.sm } : undefined,
              ]}
            >
              {title}
            </Text>
          </>
        )}
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radii.md,
    overflow: 'hidden',
  },
  text: {
    letterSpacing: 0.5,
  },
});
