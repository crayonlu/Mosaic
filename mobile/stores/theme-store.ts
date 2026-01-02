import { DarkTheme, LightTheme, ThemeMode, type Theme } from '@/constants/theme'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

interface ThemeState {
  themeMode: ThemeMode
  theme: Theme
  isDark: boolean
  setThemeMode: (mode: ThemeMode) => void
  toggleTheme: () => void
}

export const useThemeStore = create<ThemeState>()(
  persist(
    set => ({
      themeMode: 'light',
      theme: LightTheme,
      isDark: false,
      setThemeMode: (mode: ThemeMode) => {
        const isDark = mode === 'dark'
        set({
          themeMode: mode,
          theme: isDark ? DarkTheme : LightTheme,
          isDark,
        })
      },
      toggleTheme: () => {
        set(state => {
          const newMode = state.themeMode === 'light' ? 'dark' : 'light'
          const isDark = newMode === 'dark'
          return {
            themeMode: newMode,
            theme: isDark ? DarkTheme : LightTheme,
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
