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

export const QUIET_PAPER_MOOD_COLORS = {
  joy: '#D9A441',
  anger: '#B65C5C',
  sadness: '#6C92A8',
  calm: '#6BAE9C',
  anxiety: '#B6785D',
  focus: '#5A79B8',
  tired: '#8A867F',
  neutral: '#9A948A',
} as const
