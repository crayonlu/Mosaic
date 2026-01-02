/**
 * Mosaic Mobile Theme Configuration
 * Glassmorphism style with Ocean Breeze color palette
 * 搭配桌面端的风格，使用玻璃态设计和海洋微风配色
 */

import { Platform } from 'react-native'

// ============================================================================
// Color Palette - Ocean Breeze Theme
// ============================================================================
export const ThemeColors = {
  // Primary colors based on desktop app's #E6F4FE
  primary: {
    50: '#EBF8FE',
    100: '#E6F4FE',
    200: '#D6ECFB',
    300: '#B9DDF7',
    400: '#8CCBF1',
    500: '#0a7ea4', // Main primary color
    600: '#086787',
    700: '#06526a',
    800: '#044358',
    900: '#023749',
  },

  // Secondary accent colors
  accent: {
    purple: { DEFAULT: '#A78BFA', light: '#DDD6FE', dark: '#7C3AED' },
    pink: { DEFAULT: '#F472B6', light: '#FBCFE8', dark: '#DB2777' },
    green: { DEFAULT: '#34D399', light: '#A7F3D0', dark: '#059669' },
    orange: { DEFAULT: '#FB923C', light: '#FED7AA', dark: '#EA580C' },
    red: { DEFAULT: '#F87171', light: '#FECACA', dark: '#DC2626' },
  },

  // Neutral colors
  neutral: {
    0: '#ffffff',
    50: '#FAFAFA',
    100: '#F5F5F5',
    200: '#E5E5E5',
    300: '#D4D4D4',
    400: '#A3A3A3',
    500: '#737373',
    600: '#525252',
    700: '#404040',
    800: '#262626',
    900: '#171717',
    950: '#0a0a0a',
  },
} as const

// ============================================================================
// Theme Modes
// ============================================================================
export type ThemeMode = 'light' | 'dark' | 'auto'

export const LightTheme = {
  primary: ThemeColors.primary[100],
  primaryDark: ThemeColors.primary[500],
  primaryLight: '#ffffff',

  background: '#FFFFFF',
  backgroundSecondary: '#F8FAFC',
  backgroundGlass: 'rgba(255, 255, 255, 0.7)',

  surface: '#FFFFFF',
  surfaceGlass: 'rgba(255, 255, 255, 0.85)',

  text: ThemeColors.neutral[900],
  textSecondary: ThemeColors.neutral[600],
  textTertiary: ThemeColors.neutral[400],

  border: ThemeColors.neutral[200],
  borderLight: ThemeColors.neutral[100],

  shadow: 'rgba(0, 0, 0, 0.1)',
  shadowGlass: 'rgba(0, 0, 0, 0.05)',

  // Glassmorphism blur
  blur: 20,

  // Gradient colors
  gradientStart: '#E6F4FE',
  gradientEnd: '#F0F9FF',
}

export const DarkTheme = {
  primary: ThemeColors.primary[700],
  primaryDark: ThemeColors.primary[400],
  primaryLight: ThemeColors.primary[900],

  background: '#0F172A',
  backgroundSecondary: '#1E293B',
  backgroundGlass: 'rgba(15, 23, 42, 0.7)',

  surface: '#1E293B',
  surfaceGlass: 'rgba(30, 41, 59, 0.85)',

  text: ThemeColors.neutral[50],
  textSecondary: ThemeColors.neutral[400],
  textTertiary: ThemeColors.neutral[500],

  border: ThemeColors.neutral[700],
  borderLight: ThemeColors.neutral[800],

  shadow: 'rgba(0, 0, 0, 0.3)',
  shadowGlass: 'rgba(0, 0, 0, 0.15)',

  blur: 20,

  gradientStart: '#1E293B',
  gradientEnd: '#0F172A',
}

// Base theme type that accepts any string values for color properties
export interface BaseTheme {
  primary: string
  primaryDark: string
  primaryLight: string
  background: string
  backgroundSecondary: string
  backgroundGlass: string
  surface: string
  surfaceGlass: string
  text: string
  textSecondary: string
  textTertiary: string
  border: string
  borderLight: string
  shadow: string
  shadowGlass: string
  blur: number
  gradientStart: string
  gradientEnd: string
}

// Export types that work with both LightTheme and DarkTheme
export type ThemeColorsType = BaseTheme

// ============================================================================
// Typography
// ============================================================================
export const Typography = {
  // Font sizes in pixels
  fontSize: {
    xs: 12,
    sm: 14,
    base: 16,
    lg: 18,
    xl: 20,
    '2xl': 24,
    '3xl': 30,
    '4xl': 36,
    '5xl': 48,
  },

  // Font weights
  fontWeight: {
    regular: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
  },

  // Letter spacing
  letterSpacing: {
    tight: -0.5,
    normal: 0,
    wide: 0.5,
  } as const,

  // Line heights
  lineHeight: {
    tight: 1.2,
    normal: 1.5,
    relaxed: 1.75,
  },
} as const

// ============================================================================
// Spacing
// ============================================================================
export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  '2xl': 48,
  '3xl': 64,
  '4xl': 96,
} as const

// ============================================================================
// Border Radius
// ============================================================================
export const BorderRadius = {
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  '2xl': 20,
  full: 9999,
} as const

// ============================================================================
// Shadows
// ============================================================================
export const Shadows = {
  none: {
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  xs: {
    shadowColor: 'rgba(0, 0, 0, 0.05)',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 1,
    shadowRadius: 2,
    elevation: 1,
  },
  sm: {
    shadowColor: 'rgba(0, 0, 0, 0.08)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 4,
    elevation: 2,
  },
  md: {
    shadowColor: 'rgba(0, 0, 0, 0.1)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 4,
  },
  lg: {
    shadowColor: 'rgba(0, 0, 0, 0.12)',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 1,
    shadowRadius: 24,
    elevation: 8,
  },
  xl: {
    shadowColor: 'rgba(0, 0, 0, 0.15)',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 1,
    shadowRadius: 32,
    elevation: 12,
  },
  // Glass effect shadow
  glass: {
    shadowColor: Platform.select({
      ios: 'rgba(0, 0, 0, 0.08)',
      android: 'rgba(0, 0, 0, 0.15)',
    }),
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 16,
    elevation: 6,
  },
} as const

// ============================================================================
// Animations
// ============================================================================
export const Animations = {
  duration: {
    fast: 150,
    normal: 300,
    slow: 500,
  },
  easing: {
    easeIn: 'ease-in',
    easeOut: 'ease-out',
    easeInOut: 'ease-in-out',
  },
} as const

// ============================================================================
// Screen/Component Heights
// ============================================================================
export const layout = {
  // Tab bar
  tabBarHeight: 60,
  tabBarIconSize: 24,

  // Header
  headerHeight: 56,
  headerIconSize: 24,

  // Input/Editor
  inputMinHeight: 120,
  inputMaxHeight: 300,
  fabSize: 56,

  // Cards
  cardMinHeight: 80,

  // Modal
  modalHeaderHeight: 60,
} as const

// ============================================================================
// Export default theme
// ============================================================================
export const defaultTheme = LightTheme

// ============================================================================
// Export types
// ============================================================================
export type ShadowType = keyof typeof Shadows
export type SpacingSize = keyof typeof Spacing
export type RadiusSize = keyof typeof BorderRadius
export type FontSizeType = keyof typeof Typography.fontSize
