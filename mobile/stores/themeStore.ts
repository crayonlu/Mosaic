import {
    CleanSlateDarkTheme,
    CleanSlateLightTheme,
    DarkTheme,
    LightTheme,
    ThemeMode,
    ThemeName,
    type Theme,
} from '@/constants/theme'
import { mmkv, mmkvZustandStorage } from '@/lib/storage/mmkv'
import { useEffect, useRef } from 'react'
import { useColorScheme } from 'react-native'
import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

const THEME_STORAGE_KEY = 'mosaic-theme-storage'

function getPersistedState(): { themeMode: ThemeMode | null; themeName: ThemeName } {
  const raw = mmkv.getString(THEME_STORAGE_KEY)
  const fallback = { themeMode: null, themeName: 'quietPaper' as ThemeName }
  if (!raw) return fallback

  try {
    const parsed = JSON.parse(raw) as {
      state?: { themeMode?: ThemeMode | null; themeName?: ThemeName }
    }
    const mode = parsed?.state?.themeMode
    const name = parsed?.state?.themeName
    return {
      themeMode: mode === 'dark' || mode === 'light' ? mode : null,
      themeName: name === 'cleanSlate' ? 'cleanSlate' : 'quietPaper',
    }
  } catch {
    return fallback
  }
}

const initialState = getPersistedState()

const getTheme = (mode: ThemeMode, name: ThemeName): Theme => {
  if (name === 'cleanSlate') {
    return mode === 'dark' ? CleanSlateDarkTheme : CleanSlateLightTheme
  }
  return mode === 'dark' ? DarkTheme : LightTheme
}

interface ThemeState {
  themeMode: ThemeMode | null
  themeName: ThemeName
  theme: Theme
  isDark: boolean
  setThemeMode: (mode: ThemeMode) => void
  setThemeName: (name: ThemeName) => void
  toggleTheme: () => void
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      themeMode: initialState.themeMode,
      themeName: initialState.themeName,
      theme: initialState.themeMode
        ? getTheme(initialState.themeMode, initialState.themeName)
        : LightTheme,
      isDark: initialState.themeMode === 'dark',
      setThemeMode: (mode: ThemeMode) => {
        const { themeName } = get()
        set({
          themeMode: mode,
          theme: getTheme(mode, themeName),
          isDark: mode === 'dark',
        })
      },
      setThemeName: (name: ThemeName) => {
        const mode = get().themeMode ?? 'light'
        set({
          themeName: name,
          theme: getTheme(mode, name),
        })
      },
      toggleTheme: () => {
        set(state => {
          const currentMode = state.themeMode ?? 'light'
          const newMode = currentMode === 'light' ? 'dark' : 'light'
          return {
            themeMode: newMode,
            theme: getTheme(newMode, state.themeName),
            isDark: newMode === 'dark',
          }
        })
      },
    }),
    {
      name: 'mosaic-theme-storage',
      storage: createJSONStorage(() => mmkvZustandStorage),
      partialize: state => ({ themeMode: state.themeMode, themeName: state.themeName }),
      merge: (persistedState, currentState) => {
        const persisted = persistedState as Partial<ThemeState> | undefined
        const mode = persisted?.themeMode ?? currentState.themeMode ?? null
        const name: ThemeName = persisted?.themeName === 'cleanSlate' ? 'cleanSlate' : 'quietPaper'

        return {
          ...currentState,
          themeMode: mode,
          themeName: name,
          theme: mode ? getTheme(mode, name) : currentState.theme,
          isDark: mode === 'dark',
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
