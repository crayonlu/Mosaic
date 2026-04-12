import { DarkTheme, LightTheme, ThemeMode, type Theme } from '@/constants/theme'
import { mmkv, mmkvZustandStorage } from '@/lib/storage/mmkv'
import { useEffect, useRef } from 'react'
import { useColorScheme } from 'react-native'
import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

const THEME_STORAGE_KEY = 'mosaic-theme-storage'

function getPersistedThemeMode(): ThemeMode | null {
  const raw = mmkv.getString(THEME_STORAGE_KEY)
  if (!raw) {
    return null
  }

  try {
    const parsed = JSON.parse(raw) as {
      state?: { themeMode?: ThemeMode | null }
    }
    const mode = parsed?.state?.themeMode
    return mode === 'dark' || mode === 'light' ? mode : null
  } catch {
    return null
  }
}

const initialThemeMode = getPersistedThemeMode()

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
      themeMode: initialThemeMode,
      theme: initialThemeMode ? getTheme(initialThemeMode) : LightTheme,
      isDark: initialThemeMode === 'dark',
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
      storage: createJSONStorage(() => mmkvZustandStorage),
      partialize: state => ({ themeMode: state.themeMode }),
      merge: (persistedState, currentState) => {
        const persisted = persistedState as Partial<ThemeState> | undefined
        const mode = persisted?.themeMode ?? currentState.themeMode ?? null
        const isDark = mode === 'dark'

        return {
          ...currentState,
          themeMode: mode,
          theme: mode ? getTheme(mode) : currentState.theme,
          isDark,
        }
      },
    }
  )
)

export function useThemeInit() {
  const colorScheme = useColorScheme()
  const initialized = useRef(false)

  useEffect(() => {
    if (initialized.current) return
    initialized.current = true

    const applySystemThemeIfUnset = () => {
      const state = useThemeStore.getState()
      if (state.themeMode !== null) {
        return
      }

      const systemMode: ThemeMode = colorScheme === 'dark' ? 'dark' : 'light'
      state.setThemeMode(systemMode)
    }

    if (useThemeStore.persist.hasHydrated()) {
      applySystemThemeIfUnset()
      return
    }

    const unsubscribeHydration = useThemeStore.persist.onFinishHydration(() => {
      applySystemThemeIfUnset()
    })

    return unsubscribeHydration
  }, [colorScheme])
}
