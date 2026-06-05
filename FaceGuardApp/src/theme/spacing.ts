/**
 * FaceGuard Offline – Design System: Spacing & Layout
 * =====================================================
 */

export const Spacing = {
  /** 4px — icon padding, minimal gaps */
  xs: 4,
  /** 8px — compact spacing */
  sm: 8,
  /** 12px — default inner padding */
  md: 12,
  /** 16px — card padding, section gaps */
  lg: 16,
  /** 24px — major section gaps */
  xl: 24,
  /** 32px — screen-level padding */
  xxl: 32,
  /** 48px — hero spacing */
  xxxl: 48,
} as const;

export const Radii = {
  /** 4px — subtle rounding */
  xs: 4,
  /** 8px — buttons, inputs */
  sm: 8,
  /** 12px — cards */
  md: 12,
  /** 16px — panels */
  lg: 16,
  /** 24px — modals */
  xl: 24,
  /** 9999px — pill shapes */
  full: 9999,
} as const;

export const Shadows = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  glow: (color: string) => ({
    shadowColor: color,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 10,
  }),
} as const;
