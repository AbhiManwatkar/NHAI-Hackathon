/**
 * @file index.ts
 * @description Main theme hub for FaceGuard Offline.
 * Exposes colors, typography, spacing, and a makeStyles helper.
 * 
 * @module theme
 * @version 1.0.0
 */

import { Platform, ViewStyle, TextStyle, ImageStyle } from 'react-native';
import { Colors } from './colors';
import { Typography } from './typography';
import { Spacing } from './spacing';

export const Theme = {
  colors: Colors,
  typography: Typography,
  spacing: Spacing,
  
  // Platform specific shadow / elevation styles
  shadows: {
    small: Platform.select({
      ios: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 4,
      } as ViewStyle,
      android: {
        elevation: 2,
      } as ViewStyle,
    }),
    medium: Platform.select({
      ios: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
      } as ViewStyle,
      android: {
        elevation: 4,
      } as ViewStyle,
    }),
    large: Platform.select({
      ios: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.3,
        shadowRadius: 16,
      } as ViewStyle,
      android: {
        elevation: 8,
      } as ViewStyle,
    }),
  },
} as const;

export type AppTheme = typeof Theme;

type NamedStyles<T> = { [P in keyof T]: ViewStyle | TextStyle | ImageStyle };

/**
 * Factory function to create themed StyleSheets.
 * Usage:
 * const useStyles = makeStyles((theme) => ({
 *   container: { backgroundColor: theme.colors.background.primary }
 * }));
 */
export function makeStyles<T extends NamedStyles<T> | NamedStyles<any>>(
  stylesFactory: (theme: AppTheme) => T
): () => T {
  return () => stylesFactory(Theme);
}

export { Colors } from './colors';
export { Typography } from './typography';
export { Spacing } from './spacing';
export default Theme;
