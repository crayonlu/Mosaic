/**
 * useTheme Hook
 * Provides theme and theme utilities
 */

import { useThemeStore } from '@/stores/themeStore'

export function useTheme() {
  const { theme, themeName, setThemeName } = useThemeStore()

  return {
    theme,
    themeName,
    setThemeName,
  }
}
