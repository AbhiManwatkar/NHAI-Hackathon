/**
 * @file colors.ts
 * @description Complete color palette for FaceGuard Offline.
 *
 * All colors are derived from the official NHAI brand guidelines.
 * Semantic tokens map brand colors to functional roles so that
 * component code never hard-codes hex values.
 *
 * Usage:
 * ```ts
 * import { Colors } from '@/theme/colors';
 * <View style={{ backgroundColor: Colors.background.primary }} />
 * ```
 */

// ─── Brand Primitives ────────────────────────────────────────────────
/** Raw NHAI brand palette – use semantic tokens in components instead. */
export const BrandPalette = {
  orange: '#FF6B00',
  blue: '#1A3C5E',
  darkBg: '#0D1B2A',
  surface: '#1B2838',
  white: '#FFFFFF',
  textSecondary: '#B0BEC5',
  success: '#00C853',
  error: '#FF1744',
  warning: '#FFD600',
} as const;

// ─── Semantic Color Tokens ───────────────────────────────────────────

/** Primary action & accent colors */
export const primary = {
  /** Main CTA / accent – NHAI Orange */
  main: BrandPalette.orange,
  /** Dark accent – NHAI Blue */
  dark: BrandPalette.blue,
  /** 15 % opacity orange for subtle highlights */
  light: 'rgba(255, 107, 0, 0.15)',
  /** Contrast text on primary surfaces */
  contrastText: BrandPalette.white,
} as const;

/** Background surfaces */
export const background = {
  /** Root / screen background */
  primary: BrandPalette.darkBg,
  /** Card / elevated surface background */
  secondary: BrandPalette.surface,
  /** Overlay / modal backdrop at 60 % opacity */
  overlay: 'rgba(13, 27, 42, 0.60)',
  /** Semi-transparent camera overlay mask */
  cameraMask: 'rgba(13, 27, 42, 0.75)',
} as const;

/** Surface colors for cards, sheets, and modals */
export const surface = {
  /** Default card surface */
  default: BrandPalette.surface,
  /** Slightly elevated surface */
  elevated: '#223344',
  /** Pressed / active surface state */
  pressed: '#2A3F55',
  /** Border / divider on surfaces */
  border: 'rgba(176, 190, 197, 0.15)',
} as const;

/** Text colors */
export const text = {
  /** Primary readable text */
  primary: BrandPalette.white,
  /** Secondary / muted text */
  secondary: BrandPalette.textSecondary,
  /** Disabled text */
  disabled: 'rgba(176, 190, 197, 0.40)',
  /** Inverse text for light backgrounds */
  inverse: BrandPalette.darkBg,
  /** Link / interactive text */
  link: BrandPalette.orange,
} as const;

/** Feedback / status colors */
export const status = {
  success: BrandPalette.success,
  successLight: 'rgba(0, 200, 83, 0.15)',
  error: BrandPalette.error,
  errorLight: 'rgba(255, 23, 68, 0.15)',
  warning: BrandPalette.warning,
  warningLight: 'rgba(255, 214, 0, 0.15)',
  info: '#2196F3',
  infoLight: 'rgba(33, 150, 243, 0.15)',
} as const;

/** Face-detection quality indicator colors */
export const detection = {
  /** Good quality / high confidence */
  good: BrandPalette.success,
  /** Fair quality / medium confidence */
  fair: BrandPalette.warning,
  /** Poor quality / low confidence */
  poor: BrandPalette.error,
  /** Scanning animation color */
  scanLine: BrandPalette.orange,
} as const;

/** Sync-state indicator colors */
export const sync = {
  /** All records synced */
  synced: BrandPalette.success,
  /** Records pending upload */
  pending: BrandPalette.orange,
  /** Sync error */
  error: BrandPalette.error,
  /** Currently syncing */
  active: BrandPalette.orange,
} as const;

// ─── Aggregate Export ────────────────────────────────────────────────

/**
 * Unified Colors object.
 *
 * Prefer importing the top-level `Colors` and accessing nested
 * properties (`Colors.primary.main`, `Colors.status.success`, etc.)
 * to keep component code self-documenting.
 */
export const Colors = {
  brand: BrandPalette,
  primary,
  background,
  surface,
  text,
  status,
  detection,
  sync,
} as const;

/** Convenience type for any color token path. */
export type ColorToken = typeof Colors;

export default Colors;
