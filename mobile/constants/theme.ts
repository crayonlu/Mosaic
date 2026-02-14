export type ThemeMode = 'light' | 'dark'

export interface Theme {
  background: string
  surface: string
  text: string
  textSecondary: string
  border: string
  spacing: number
  primary: string
  link: string
  mark: string
}

export const LightTheme: Theme = {
  background: '#FFF5EB',
  surface: '#FFF7EF',
  text: '#2D2D2D',
  textSecondary: '#757575',
  border: 'rgba(0, 0, 0, 0.08)',
  spacing: 16,
  primary: '#B2794C',
  link: '#FFB5A7',
  mark: '#FFD93D',
}

export const DarkTheme: Theme = {
  background: '#1A1A2E',
  surface: '#1F2937',
  text: '#F5F5F5',
  textSecondary: '#A0AEC0',
  border: 'rgba(255, 255, 255, 0.1)',
  spacing: 16,
  primary: '#8A9B8F',
  link: '#B8A9A9',
  mark: '#FFD93D',
}
