/**
 * @file spacing.ts
 * @description Spacing scale, border radii, and shadow presets for
 * FaceGuard Offline.
 *
 * The spacing scale follows a 4-point grid so all values are multiples
 * of 4 dp, keeping layouts visually consistent.
 *
 * Usage:
 * ```ts
 * import { Spacing, BorderRadius, Shadows } from '@/theme/spacing';
 * <View style={{ padding: Spacing.md, borderRadius: BorderRadius.lg, ...Shadows.card }} />
 * ```
 */

import { Platform, ViewStyle } from 'react-native';

// ─── Spacing Scale ───────────────────────────────────────────────────

/**
 * 4-point spacing scale.
 * Use semantic names rather than raw numbers so intent is clear.
 */
export const Spacing = {
  /** 2 dp – hairline gaps */
  xxs: 2,
  /** 4 dp – tight inner padding */
  xs: 4,
  /** 8 dp – default inner padding */
  sm: 8,
  /** 12 dp – between related elements */
  ms: 12,
  /** 16 dp – standard section padding */
  md: 16,
  /** 20 dp – comfortable card padding */
  mld: 20,
  /** 24 dp – section gaps */
  lg: 24,
  /** 32 dp – screen horizontal margins */
  xl: 32,
  /** 48 dp – major section breaks */
  xxl: 48,
  /** 64 dp – splash / hero spacing */
  xxxl: 64,
} as const;

// ─── Border Radius ───────────────────────────────────────────────────

/** Consistent corner rounding presets. */
export const BorderRadius = {
  /** 0 dp – sharp corners */
  none: 0,
  /** 4 dp – subtle rounding (inputs) */
  xs: 4,
  /** 8 dp – default card rounding */
  sm: 8,
  /** 12 dp – buttons, tags */
  md: 12,
  /** 16 dp – modal sheets */
  lg: 16,
  /** 24 dp – pill-shaped elements */
  xl: 24,
  /** 9999 dp – fully circular */
  full: 9999,
} as const;

// ─── Shadow / Elevation Presets ──────────────────────────────────────

/**
 * Cross-platform shadow helpers.
 *
 * On Android we set `elevation`; on iOS we use the shadow* properties.
 * Each preset is a partial `ViewStyle` you can spread into your styles.
 */
export const Shadows: Record<string, ViewStyle> = {
  /** No shadow */
  none: {
    elevation: 0,
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
  },

  /** Subtle card shadow – elevation 2 */
  sm: {
    elevation: 2,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.18,
    shadowRadius: 2,
  },

  /** Default card shadow – elevation 4 */
  card: {
    elevation: 4,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.22,
    shadowRadius: 4,
  },

  /** Raised element (FAB, bottom bar) – elevation 8 */
  md: {
    elevation: 8,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 8,
  },

  /** Modal / dialog shadow – elevation 16 */
  lg: {
    elevation: 16,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
  },

  /** Top-most layer (toast, tooltip) – elevation 24 */
  xl: {
    elevation: 24,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.42,
    shadowRadius: 24,
  },

  /**
   * Glow effect using the NHAI orange.
   * Useful for active / scanning states.
   */
  orangeGlow: {
    elevation: 8,
    shadowColor: '#FF6B00',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.45,
    shadowRadius: 12,
  },

  /**
   * Success glow for positive-feedback states.
   */
  successGlow: {
    elevation: 8,
    shadowColor: '#00C853',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
  },

  /**
   * Error glow for alert states.
   */
  errorGlow: {
    elevation: 8,
    shadowColor: '#FF1744',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
  },
} as const;

// ─── Layout Helpers ──────────────────────────────────────────────────

/** Common screen-level padding (horizontal). */
export const ScreenPadding: ViewStyle = {
  paddingHorizontal: Spacing.md,
};

/** Safe-area aware bottom padding for lists. */
export const ListContentPadding: ViewStyle = {
  paddingHorizontal: Spacing.md,
  paddingBottom: Spacing.xxl,
};

/**
 * Hit-slop preset for small tap targets (icons, small buttons).
 * Ensures a minimum 44×44 dp touch area per accessibility guidelines.
 */
export const HitSlop = {
  top: Spacing.sm,
  bottom: Spacing.sm,
  left: Spacing.sm,
  right: Spacing.sm,
} as const;

// ─── Aggregate Export ────────────────────────────────────────────────

export const SpacingTheme = {
  Spacing,
  BorderRadius,
  Shadows,
  ScreenPadding,
  ListContentPadding,
  HitSlop,
} as const;

export default SpacingTheme;
