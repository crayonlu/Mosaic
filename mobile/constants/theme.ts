export type ThemeMode = 'light' | 'dark'

export interface Theme {
  background: string
  surface: string
  text: string
  textSecondary: string
  border: string
  borderRadius: number
  spacing: number
  primary: string
  card: string
  link: string
  mark: string
}

export const LightTheme: Theme = {
  background: '#FFF9F5',
  surface: '#FFF5EB',
  text: '#2D2D2D',
  textSecondary: '#757575',
  border: 'rgba(0, 0, 0, 0.08)',
  borderRadius: 20,
  spacing: 16,
  primary: '#8F5F39',
  card: '#FFF5EB',
  link: '#FFB5A7',
  mark: '#FFD93D',
}

export const DarkTheme: Theme = {
  background: '#1A1A2E',
  surface: '#1F2937',
  text: '#F5F5F5',
  textSecondary: '#A0AEC0',
  border: 'rgba(255, 255, 255, 0.1)',
  borderRadius: 20,
  spacing: 16,
  primary: '#64A9E9',
  card: '#1F2937',
  link: '#FFB5A7',
  mark: '#FFD93D',
}
