/**
 * FaceGuard Offline – Design System: Color Palette
 * ==================================================
 *
 * A premium dark-mode-first color system inspired by biometric security
 * aesthetics. Uses HSL-derived colors for harmony and legibility.
 */

export const Colors = {
  // ── Primary Gradient ──────────────────────────────────────────────
  primary: {
    50:  '#E8F5FE',
    100: '#B8E2FC',
    200: '#88CFFA',
    300: '#58BCF8',
    400: '#28A9F6',
    500: '#0A8FE0', // Main accent — electric blue
    600: '#0876BA',
    700: '#065D94',
    800: '#04446E',
    900: '#022B48',
  },

  // ── Accent (Teal / Success) ───────────────────────────────────────
  accent: {
    50:  '#E6FFF7',
    100: '#B3FFE6',
    200: '#80FFD5',
    300: '#4DFFC4',
    400: '#1AFFB3',
    500: '#00E69D', // Liveness / success indicator
    600: '#00B37A',
    700: '#008058',
    800: '#004D35',
    900: '#001A12',
  },

  // ── Danger / Spoof Alert ──────────────────────────────────────────
  danger: {
    50:  '#FFF0F0',
    100: '#FFD1D1',
    200: '#FFB3B3',
    300: '#FF8585',
    400: '#FF5757',
    500: '#FF3B3B', // Rejection / spoof detected
    600: '#CC2F2F',
    700: '#992323',
    800: '#661717',
    900: '#330C0C',
  },

  // ── Warning (Amber) ──────────────────────────────────────────────
  warning: {
    50:  '#FFF8E6',
    100: '#FFEBB3',
    200: '#FFDE80',
    300: '#FFD14D',
    400: '#FFC41A',
    500: '#FFB800', // Low confidence / retry
    600: '#CC9300',
    700: '#996E00',
    800: '#664A00',
    900: '#332500',
  },

  // ── Background / Surface ──────────────────────────────────────────
  bg: {
    primary:   '#0B0F19', // Deepest background
    secondary: '#111827', // Card / panel background
    tertiary:  '#1A2236', // Elevated surface
    overlay:   'rgba(11, 15, 25, 0.85)', // Modal backdrop
  },

  // ── Text ──────────────────────────────────────────────────────────
  text: {
    primary:   '#F1F5F9', // High-emphasis text
    secondary: '#94A3B8', // Medium-emphasis text
    tertiary:  '#64748B', // Low-emphasis text / placeholders
    inverse:   '#0B0F19', // Text on light backgrounds
  },

  // ── Border / Divider ──────────────────────────────────────────────
  border: {
    subtle:  '#1E293B',
    default: '#334155',
    strong:  '#475569',
  },

  // ── Glassmorphism Fills ───────────────────────────────────────────
  glass: {
    light:  'rgba(255, 255, 255, 0.05)',
    medium: 'rgba(255, 255, 255, 0.08)',
    strong: 'rgba(255, 255, 255, 0.12)',
  },

  // ── Gradients (for use with LinearGradient) ───────────────────────
  gradients: {
    primary:    ['#0A8FE0', '#065D94'],
    accent:     ['#00E69D', '#008058'],
    danger:     ['#FF5757', '#CC2F2F'],
    surface:    ['#111827', '#0B0F19'],
    glow:       ['rgba(10, 143, 224, 0.4)', 'rgba(10, 143, 224, 0)'],
    accentGlow: ['rgba(0, 230, 157, 0.4)', 'rgba(0, 230, 157, 0)'],
  },
} as const;

export type ColorPalette = typeof Colors;
