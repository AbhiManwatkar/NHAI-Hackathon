/**
 * FaceGuard Offline – Design System: Typography
 * ===============================================
 *
 * Uses the system font stack for maximum performance on React Native.
 * Font weights use numeric values for cross-platform consistency.
 */

import { Platform, TextStyle } from 'react-native';

const fontFamily = Platform.select({
  ios: 'System',
  android: 'Roboto',
  default: 'System',
});

/** Base text styles for the FaceGuard design system */
export const Typography: Record<string, TextStyle> = {
  // ── Display ─────────────────────────────────────────────────────
  displayLarge: {
    fontFamily,
    fontSize: 36,
    fontWeight: '800',
    letterSpacing: -0.5,
    lineHeight: 44,
  },
  displayMedium: {
    fontFamily,
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.3,
    lineHeight: 36,
  },
  displaySmall: {
    fontFamily,
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: -0.2,
    lineHeight: 32,
  },

  // ── Heading ─────────────────────────────────────────────────────
  headingLarge: {
    fontFamily,
    fontSize: 20,
    fontWeight: '600',
    letterSpacing: 0,
    lineHeight: 28,
  },
  headingMedium: {
    fontFamily,
    fontSize: 18,
    fontWeight: '600',
    letterSpacing: 0,
    lineHeight: 26,
  },
  headingSmall: {
    fontFamily,
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.1,
    lineHeight: 24,
  },

  // ── Body ────────────────────────────────────────────────────────
  bodyLarge: {
    fontFamily,
    fontSize: 16,
    fontWeight: '400',
    letterSpacing: 0.2,
    lineHeight: 24,
  },
  bodyMedium: {
    fontFamily,
    fontSize: 14,
    fontWeight: '400',
    letterSpacing: 0.1,
    lineHeight: 20,
  },
  bodySmall: {
    fontFamily,
    fontSize: 12,
    fontWeight: '400',
    letterSpacing: 0.1,
    lineHeight: 16,
  },

  // ── Label ───────────────────────────────────────────────────────
  labelLarge: {
    fontFamily,
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.5,
    lineHeight: 20,
    textTransform: 'uppercase',
  },
  labelMedium: {
    fontFamily,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.5,
    lineHeight: 16,
    textTransform: 'uppercase',
  },
  labelSmall: {
    fontFamily,
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.5,
    lineHeight: 14,
    textTransform: 'uppercase',
  },

  // ── Mono (for metrics / scores) ─────────────────────────────────
  mono: {
    fontFamily: Platform.select({
      ios: 'Menlo',
      android: 'monospace',
      default: 'monospace',
    }),
    fontSize: 14,
    fontWeight: '500',
    letterSpacing: 0,
    lineHeight: 20,
  },
  monoLarge: {
    fontFamily: Platform.select({
      ios: 'Menlo',
      android: 'monospace',
      default: 'monospace',
    }),
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.5,
    lineHeight: 36,
  },
} as const;
