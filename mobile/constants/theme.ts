export type ThemeMode = 'light' | 'dark'

export interface Theme {
  background: string
  surface: string
  text: string
  textSecondary: string
  border: string
  borderRadius: number
  spacing: number
}

export const LightTheme: Theme = {
  background: '#FFF9F5',
  surface: '#FFFFFF',
  text: '#2D2D2D',
  textSecondary: '#757575',
  border: 'rgba(0, 0, 0, 0.08)',
  borderRadius: 20,
  spacing: 16,
}

export const DarkTheme: Theme = {
  background: '#1A1A2E',
  surface: '#1F2937',
  text: '#F5F5F5',
  textSecondary: '#A0AEC0',
  border: 'rgba(255, 255, 255, 0.1)',
  borderRadius: 20,
  spacing: 16,
}
