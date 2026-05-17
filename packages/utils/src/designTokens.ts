export interface ThemeScale {
  background: string
  surface: string
  text: string
  textSecondary: string
  border: string
  primary: string
  primaryAccent: string
  onPrimary: string
  link: string
  mark: string
  success: string
  error: string
  warning: string
  info: string
  overlay: string
}

export interface ShadowToken {
  shadowColor: string
  shadowOffset: { width: number; height: number }
  shadowOpacity: number
  shadowRadius: number
  elevation: number
}

export interface TypographyToken {
  fontSize: number
  fontWeight: '400' | '500' | '600' | '700'
  lineHeight: number
  letterSpacing: number
}

export interface ThemeShadowSet {
  subtle: ShadowToken
  medium: ShadowToken
  strong: ShadowToken
}

export interface ThemeTypographySet {
  display: TypographyToken
  titleLarge: TypographyToken
  title: TypographyToken
  bodyLarge: TypographyToken
  body: TypographyToken
  label: TypographyToken
  caption: TypographyToken
}

export const QUIET_PAPER_LIGHT: ThemeScale = {
  background: '#F8F5EF',
  surface: '#F2ECE2',
  text: '#1F2430',
  textSecondary: '#667085',
  border: '#D9D2C6',
  primary: '#9A6B3F',
  primaryAccent: '#C08A58',
  onPrimary: '#F8F5EF',
  link: '#3D6FA6',
  mark: '#D9A441',
  success: '#2F8F6A',
  error: '#C94F4F',
  warning: '#A06D22',
  info: '#3D6FA6',
  overlay: 'rgba(31, 36, 48, 0.45)',
}

export const QUIET_PAPER_DARK: ThemeScale = {
  background: '#171719',
  surface: '#1F1F22',
  text: '#F4EFE7',
  textSecondary: '#B8B0A3',
  border: '#3A352D',
  primary: '#C08A58',
  primaryAccent: '#D39B66',
  onPrimary: '#1F1F22',
  link: '#7FA9D8',
  mark: '#D9A441',
  success: '#52B58F',
  error: '#E07A7A',
  warning: '#D2A35A',
  info: '#7FA9D8',
  overlay: 'rgba(18, 18, 20, 0.65)',
}

export const CLEAN_SLATE_LIGHT: ThemeScale = {
  background: '#F2F2F2',
  surface: '#FFFFFF',
  text: '#0A0A0A',
  textSecondary: '#525252',
  border: '#E5E5E5',
  primary: '#16a34a',
  primaryAccent: '#15803d',
  onPrimary: '#FFFFFF',
  link: '#2563EB',
  mark: '#16a34a',
  success: '#22C55E',
  error: '#EF4444',
  warning: '#F59E0B',
  info: '#3B82F6',
  overlay: 'rgba(10, 10, 10, 0.45)',
}

export const CLEAN_SLATE_DARK: ThemeScale = {
  background: '#0A0A0A',
  surface: '#141414',
  text: '#F5F5F5',
  textSecondary: '#A3A3A3',
  border: '#262626',
  primary: '#a8f099',
  primaryAccent: '#c6f6be',
  onPrimary: '#0A0A0A',
  link: '#60A5FA',
  mark: '#a8f099',
  success: '#86efac',
  error: '#fca5a5',
  warning: '#fcd34d',
  info: '#93c5fd',
  overlay: 'rgba(0, 0, 0, 0.6)',
}

export const MOOD_COLORS = {
  joy: '#E2C9B3',
  anger: '#D1A9A9',
  sadness: '#A7BDD6',
  calm: '#9FC4BC',
  anxiety: '#D2B29D',
  focus: '#B4ACD1',
  tired: '#B1B8C2',
  neutral: '#D7D5CE',
} as const

/** @deprecated use MOOD_COLORS */
export const QUIET_PAPER_MOOD_COLORS = MOOD_COLORS

export const SHADOWS_LIGHT: ThemeShadowSet = {
  subtle: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  medium: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  strong: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 8,
  },
}

export const SHADOWS_DARK: ThemeShadowSet = {
  subtle: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 1,
  },
  medium: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 4,
  },
  strong: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 24,
    elevation: 8,
  },
}

export const TYPOGRAPHY: ThemeTypographySet = {
  display: {
    fontSize: 28,
    fontWeight: '700',
    lineHeight: 33.6,
    letterSpacing: -0.4,
  },
  titleLarge: {
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 25,
    letterSpacing: -0.3,
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
    lineHeight: 22.1,
    letterSpacing: -0.2,
  },
  bodyLarge: {
    fontSize: 17,
    fontWeight: '400',
    lineHeight: 26.4,
    letterSpacing: 0.15,
  },
  body: {
    fontSize: 15,
    fontWeight: '400',
    lineHeight: 23.3,
    letterSpacing: 0.15,
  },
  label: {
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 18.2,
    letterSpacing: 0.1,
  },
  caption: {
    fontSize: 12,
    fontWeight: '400',
    lineHeight: 16.8,
    letterSpacing: 0.1,
  },
}
