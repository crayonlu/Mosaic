/**
 * useColor Hook
 * Helper to get colors based on theme
 */

import { useThemeStore } from '@/stores/theme-store'

export function useColor() {
  const { theme } = useThemeStore()

  return {
    // Backgrounds
    bg: theme.background,
    bgSecondary: theme.backgroundSecondary,
    bgGlass: theme.backgroundGlass,
    surface: theme.surface,
    surfaceGlass: theme.surfaceGlass,

    // Text colors
    text: theme.text,
    textSecondary: theme.textSecondary,
    textTertiary: theme.textTertiary,

    // Primary colors
    primary: theme.primary,
    primaryDark: theme.primaryDark,
    primaryLight: theme.primaryLight,

    // Borders
    border: theme.border,
    borderLight: theme.borderLight,

    // Shadows
    shadow: theme.shadow,
    shadowGlass: theme.shadowGlass,

    // Gradients
    gradientStart: theme.gradientStart,
    gradientEnd: theme.gradientEnd,
  }
}
