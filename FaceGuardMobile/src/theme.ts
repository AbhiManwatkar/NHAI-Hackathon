/**
 * FaceGuard Offline – Design Tokens
 * All colors, spacing, typography in one module for minimal bundle size.
 */
import { Platform, TextStyle } from 'react-native';

export const C = {
  bg:      '#0B0F19',
  bg2:     '#111827',
  bg3:     '#1A2236',
  overlay: 'rgba(11,15,25,0.85)',
  p50:  '#E8F5FE', p400: '#28A9F6', p500: '#0A8FE0', p600: '#0876BA', p700: '#065D94',
  a400: '#00E69D', a500: '#00B37A',
  d400: '#FF5757', d500: '#FF3B3B',
  w400: '#FFC41A', w500: '#FFB800',
  t1: '#F1F5F9', t2: '#94A3B8', t3: '#64748B',
  b1: '#1E293B', b2: '#334155', b3: '#475569',
  g1: 'rgba(255,255,255,0.05)',
  g2: 'rgba(255,255,255,0.08)',
  g3: 'rgba(255,255,255,0.12)',
} as const;

export const S = { xs:4, sm:8, md:12, lg:16, xl:24, xxl:32, xxxl:48 } as const;
export const R = { sm:8, md:12, lg:16, xl:24, full:9999 } as const;

const ff = Platform.select({ ios:'System', android:'Roboto', default:'System' });
const mono = Platform.select({ ios:'Menlo', android:'monospace', default:'monospace' });

export const T: Record<string, TextStyle> = {
  d1: { fontFamily:ff, fontSize:36, fontWeight:'800', letterSpacing:-0.5 },
  d2: { fontFamily:ff, fontSize:28, fontWeight:'700', letterSpacing:-0.3 },
  d3: { fontFamily:ff, fontSize:24, fontWeight:'700', letterSpacing:-0.2 },
  h1: { fontFamily:ff, fontSize:20, fontWeight:'600' },
  h2: { fontFamily:ff, fontSize:18, fontWeight:'600' },
  h3: { fontFamily:ff, fontSize:16, fontWeight:'600', letterSpacing:0.1 },
  b1: { fontFamily:ff, fontSize:16, fontWeight:'400', letterSpacing:0.2, lineHeight:24 },
  b2: { fontFamily:ff, fontSize:14, fontWeight:'400', letterSpacing:0.1, lineHeight:20 },
  b3: { fontFamily:ff, fontSize:12, fontWeight:'400', letterSpacing:0.1, lineHeight:16 },
  l1: { fontFamily:ff, fontSize:14, fontWeight:'600', letterSpacing:0.5, textTransform:'uppercase' as const },
  l2: { fontFamily:ff, fontSize:12, fontWeight:'600', letterSpacing:0.5, textTransform:'uppercase' as const },
  l3: { fontFamily:ff, fontSize:10, fontWeight:'600', letterSpacing:0.5, textTransform:'uppercase' as const },
  m:  { fontFamily:mono, fontSize:14, fontWeight:'500' },
  mL: { fontFamily:mono, fontSize:28, fontWeight:'700', letterSpacing:-0.5 },
};
