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

export const QUIET_PAPER: ThemeScale = {
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

export const CLEAN_SLATE: ThemeScale = {
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

/** @deprecated use QUIET_PAPER */
export const QUIET_PAPER_LIGHT = QUIET_PAPER
/** @deprecated use CLEAN_SLATE */
export const CLEAN_SLATE_LIGHT = CLEAN_SLATE

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

export const QUIET_PAPER_TYPOGRAPHY: ThemeTypographySet = {
  display: { fontSize: 28, fontWeight: '700', lineHeight: 36, letterSpacing: -0.5 },
  titleLarge: { fontSize: 20, fontWeight: '700', lineHeight: 28, letterSpacing: -0.3 },
  title: { fontSize: 17, fontWeight: '600', lineHeight: 24, letterSpacing: -0.2 },
  bodyLarge: { fontSize: 17, fontWeight: '400', lineHeight: 28, letterSpacing: 0.1 },
  body: { fontSize: 15, fontWeight: '400', lineHeight: 24, letterSpacing: 0.1 },
  label: { fontSize: 13, fontWeight: '500', lineHeight: 18, letterSpacing: 0.05 },
  caption: { fontSize: 12, fontWeight: '400', lineHeight: 17, letterSpacing: 0.05 },
}

export const CLEAN_SLATE_TYPOGRAPHY: ThemeTypographySet = {
  display: { fontSize: 28, fontWeight: '700', lineHeight: 33, letterSpacing: -0.8 },
  titleLarge: { fontSize: 20, fontWeight: '600', lineHeight: 25, letterSpacing: -0.5 },
  title: { fontSize: 17, fontWeight: '600', lineHeight: 22, letterSpacing: -0.3 },
  bodyLarge: { fontSize: 17, fontWeight: '400', lineHeight: 25, letterSpacing: 0 },
  body: { fontSize: 15, fontWeight: '400', lineHeight: 22, letterSpacing: 0 },
  label: { fontSize: 13, fontWeight: '500', lineHeight: 18, letterSpacing: 0 },
  caption: { fontSize: 11, fontWeight: '400', lineHeight: 16, letterSpacing: 0.2 },
}

export const QUIET_PAPER_SHADOWS: ThemeShadowSet = {
  subtle: { shadowColor: '#8B7355', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 6, elevation: 2 },
  medium: { shadowColor: '#8B7355', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.09, shadowRadius: 16, elevation: 6 },
  strong: { shadowColor: '#8B7355', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.12, shadowRadius: 28, elevation: 12 },
}

export const CLEAN_SLATE_SHADOWS: ThemeShadowSet = {
  subtle: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 2, elevation: 1 },
  medium: { shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 4 },
  strong: { shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.12, shadowRadius: 20, elevation: 8 },
}
