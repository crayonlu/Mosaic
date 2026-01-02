/**
 * useTheme Hook
 * Provides theme and theme utilities
 */

import { useThemeStore } from '@/stores/theme-store'

export function useTheme() {
  const { theme, themeMode, isDark, toggleTheme, setThemeMode } = useThemeStore()

  return {
    theme,
    themeMode,
    isDark,
    toggleTheme,
    setThemeMode,
  }
}
