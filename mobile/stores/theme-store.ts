/**
 * Theme Provider using Zustand
 * Manages theme state across the app
 */

import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { ThemeMode, LightTheme, DarkTheme, ThemeColorsType } from '@/constants/theme'

interface ThemeState {
  themeMode: ThemeMode
  theme: ThemeColorsType
  isDark: boolean
  setThemeMode: (mode: ThemeMode) => void
  toggleTheme: () => void
}

export const useThemeStore = create<ThemeState>()(
  persist(
    set => ({
      themeMode: 'light',
      theme: LightTheme as ThemeColorsType,
      isDark: false,
      setThemeMode: (mode: ThemeMode) => {
        const isDark = mode === 'dark' || (mode === 'auto' && false) // TODO: check system theme
        set({
          themeMode: mode,
          theme: (isDark ? DarkTheme : LightTheme) as ThemeColorsType,
          isDark,
        })
      },
      toggleTheme: () => {
        set(state => {
          const newMode = state.themeMode === 'light' ? 'dark' : 'light'
          const isDark = newMode === 'dark'
          return {
            themeMode: newMode,
            theme: (isDark ? DarkTheme : LightTheme) as ThemeColorsType,
            isDark,
          }
        })
      },
    }),
    {
      name: 'mosaic-theme-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
)
