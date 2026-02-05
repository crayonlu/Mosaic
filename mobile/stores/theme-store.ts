import { DarkTheme, LightTheme, ThemeMode, type Theme } from '@/constants/theme'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { useColorScheme } from 'react-native'
import { useEffect, useRef } from 'react'

const getTheme = (mode: ThemeMode): Theme => {
  return mode === 'dark' ? DarkTheme : LightTheme
}

interface ThemeState {
  themeMode: ThemeMode | null
  theme: Theme
  isDark: boolean
  setThemeMode: (mode: ThemeMode) => void
  toggleTheme: () => void
}

export const useThemeStore = create<ThemeState>()(
  persist(
    set => ({
      themeMode: null,
      theme: LightTheme,
      isDark: false,
      setThemeMode: (mode: ThemeMode) => {
        const isDark = mode === 'dark'
        set({
          themeMode: mode,
          theme: getTheme(mode),
          isDark,
        })
      },
      toggleTheme: () => {
        set(state => {
          const currentMode = state.themeMode ?? 'light'
          const newMode = currentMode === 'light' ? 'dark' : 'light'
          const isDark = newMode === 'dark'
          return {
            themeMode: newMode,
            theme: getTheme(newMode),
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

export function useThemeInit() {
  const { setThemeMode } = useThemeStore()
  const colorScheme = useColorScheme()
  const initialized = useRef(false)

  useEffect(() => {
    if (initialized.current) return
    initialized.current = true

    const systemMode = colorScheme === 'dark' ? 'dark' : 'light'
    setThemeMode(systemMode)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [colorScheme])
}
