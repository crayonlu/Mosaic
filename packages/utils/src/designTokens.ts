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
  joy: '#F59E0B',
  anger: '#EF4444',
  sadness: '#60A5FA',
  calm: '#34D399',
  anxiety: '#F97316',
  focus: '#A78BFA',
  tired: '#94A3B8',
  neutral: '#CBD5E1',
} as const

/** @deprecated use MOOD_COLORS */
export const QUIET_PAPER_MOOD_COLORS = MOOD_COLORS
