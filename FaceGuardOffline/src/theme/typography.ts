/**
 * @file typography.ts
 * @description Typography scale for FaceGuard Offline.
 *
 * Uses the platform system font stack (San Francisco on iOS, Roboto on
 * Android) so no custom font files are required.  All presets include
 * fontSize, lineHeight, fontWeight and letterSpacing.
 *
 * Usage:
 * ```ts
 * import { Typography } from '@/theme/typography';
 * <Text style={Typography.h1}>Dashboard</Text>
 * ```
 */

import { Platform, TextStyle } from 'react-native';

// ─── Font Family ─────────────────────────────────────────────────────

/**
 * System font family string.
 * Falls back gracefully on both platforms.
 */
export const FontFamily = Platform.select({
  ios: 'System',
  android: 'Roboto',
  default: 'System',
}) as string;

// ─── Font Sizes ──────────────────────────────────────────────────────

/** Raw size scale (in dp / pt). */
export const FontSize = {
  /** 10 dp – fine print, badges */
  xxs: 10,
  /** 12 dp – captions, timestamps */
  xs: 12,
  /** 14 dp – secondary body text */
  sm: 14,
  /** 16 dp – primary body text */
  md: 16,
  /** 18 dp – subheadings */
  lg: 18,
  /** 20 dp – section headings */
  xl: 20,
  /** 24 dp – page headings */
  xxl: 24,
  /** 30 dp – hero / display headings */
  xxxl: 30,
  /** 36 dp – splash / onboarding titles */
  display: 36,
} as const;

// ─── Font Weights ────────────────────────────────────────────────────

/** Weight tokens mapped to React Native string literal values. */
export const FontWeight = {
  regular: '400' as TextStyle['fontWeight'],
  medium: '500' as TextStyle['fontWeight'],
  semiBold: '600' as TextStyle['fontWeight'],
  bold: '700' as TextStyle['fontWeight'],
  extraBold: '800' as TextStyle['fontWeight'],
} as const;

// ─── Line Heights ────────────────────────────────────────────────────

/**
 * Line-height multipliers relative to font size.
 * `tight` is useful for headings, `relaxed` for long-form body copy.
 */
export const LineHeightMultiplier = {
  tight: 1.2,
  normal: 1.4,
  relaxed: 1.6,
} as const;

// ─── Letter Spacing ──────────────────────────────────────────────────

export const LetterSpacing = {
  tight: -0.5,
  normal: 0,
  wide: 0.5,
  extraWide: 1.0,
} as const;

// ─── Heading Presets ─────────────────────────────────────────────────

/** Display / hero heading */
export const display: TextStyle = {
  fontFamily: FontFamily,
  fontSize: FontSize.display,
  fontWeight: FontWeight.extraBold,
  lineHeight: FontSize.display * LineHeightMultiplier.tight,
  letterSpacing: LetterSpacing.tight,
};

/** H1 – primary page heading */
export const h1: TextStyle = {
  fontFamily: FontFamily,
  fontSize: FontSize.xxxl,
  fontWeight: FontWeight.bold,
  lineHeight: FontSize.xxxl * LineHeightMultiplier.tight,
  letterSpacing: LetterSpacing.tight,
};

/** H2 – section heading */
export const h2: TextStyle = {
  fontFamily: FontFamily,
  fontSize: FontSize.xxl,
  fontWeight: FontWeight.bold,
  lineHeight: FontSize.xxl * LineHeightMultiplier.tight,
  letterSpacing: LetterSpacing.normal,
};

/** H3 – subsection heading */
export const h3: TextStyle = {
  fontFamily: FontFamily,
  fontSize: FontSize.xl,
  fontWeight: FontWeight.semiBold,
  lineHeight: FontSize.xl * LineHeightMultiplier.normal,
  letterSpacing: LetterSpacing.normal,
};

/** H4 – card / widget heading */
export const h4: TextStyle = {
  fontFamily: FontFamily,
  fontSize: FontSize.lg,
  fontWeight: FontWeight.semiBold,
  lineHeight: FontSize.lg * LineHeightMultiplier.normal,
  letterSpacing: LetterSpacing.normal,
};

// ─── Body Presets ────────────────────────────────────────────────────

/** Default body text */
export const bodyLarge: TextStyle = {
  fontFamily: FontFamily,
  fontSize: FontSize.md,
  fontWeight: FontWeight.regular,
  lineHeight: FontSize.md * LineHeightMultiplier.relaxed,
  letterSpacing: LetterSpacing.normal,
};

/** Secondary body text */
export const bodyMedium: TextStyle = {
  fontFamily: FontFamily,
  fontSize: FontSize.sm,
  fontWeight: FontWeight.regular,
  lineHeight: FontSize.sm * LineHeightMultiplier.relaxed,
  letterSpacing: LetterSpacing.normal,
};

/** Small body text */
export const bodySmall: TextStyle = {
  fontFamily: FontFamily,
  fontSize: FontSize.xs,
  fontWeight: FontWeight.regular,
  lineHeight: FontSize.xs * LineHeightMultiplier.relaxed,
  letterSpacing: LetterSpacing.normal,
};

// ─── Caption / Label Presets ─────────────────────────────────────────

/** Caption – timestamps, labels */
export const caption: TextStyle = {
  fontFamily: FontFamily,
  fontSize: FontSize.xs,
  fontWeight: FontWeight.medium,
  lineHeight: FontSize.xs * LineHeightMultiplier.normal,
  letterSpacing: LetterSpacing.wide,
};

/** Overline – section dividers, all-caps labels */
export const overline: TextStyle = {
  fontFamily: FontFamily,
  fontSize: FontSize.xxs,
  fontWeight: FontWeight.semiBold,
  lineHeight: FontSize.xxs * LineHeightMultiplier.normal,
  letterSpacing: LetterSpacing.extraWide,
  textTransform: 'uppercase',
};

/** Button label */
export const button: TextStyle = {
  fontFamily: FontFamily,
  fontSize: FontSize.md,
  fontWeight: FontWeight.semiBold,
  lineHeight: FontSize.md * LineHeightMultiplier.tight,
  letterSpacing: LetterSpacing.wide,
};

/** Badge / chip label */
export const badge: TextStyle = {
  fontFamily: FontFamily,
  fontSize: FontSize.xxs,
  fontWeight: FontWeight.bold,
  lineHeight: FontSize.xxs * LineHeightMultiplier.tight,
  letterSpacing: LetterSpacing.wide,
};

// ─── Aggregate Export ────────────────────────────────────────────────

/**
 * Unified Typography object.
 *
 * ```ts
 * import { Typography } from '@/theme/typography';
 * <Text style={Typography.h2}>Section Title</Text>
 * ```
 */
export const Typography = {
  display,
  h1,
  h2,
  h3,
  h4,
  bodyLarge,
  bodyMedium,
  bodySmall,
  caption,
  overline,
  button,
  badge,
  // Primitives for custom compositions
  FontFamily,
  FontSize,
  FontWeight,
  LineHeightMultiplier,
  LetterSpacing,
} as const;

export default Typography;
