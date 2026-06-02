export const Colors = {
  brand: {
    primary: '#FF6B00',
    dark: '#1A3C5E',
    light: '#FF8C3A',
  },
  ui: {
    background: '#0F172A',
    surface: '#1E293B',
    surfaceHigh: '#334155',
    border: '#475569',
  },
  status: {
    success: '#22C55E',
    warning: '#F59E0B',
    error: '#EF4444',
    info: '#3B82F6',
  },
  text: {
    primary: '#F8FAFC',
    secondary: '#94A3B8',
    muted: '#64748B',
  },
} as const;

export type ColorToken = typeof Colors;
export default Colors;
