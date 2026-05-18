import { CleanSlateTheme, QuietPaperTheme, type Theme, type ThemeName } from '@/constants/theme'
import { mmkv, mmkvZustandStorage } from '@/lib/storage/mmkv'
import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

const THEME_STORAGE_KEY = 'mosaic-theme-storage'

const THEME_MAP: Record<ThemeName, Theme> = {
  quietPaper: QuietPaperTheme,
  cleanSlate: CleanSlateTheme,
}

function getPersistedThemeName(): ThemeName {
  const raw = mmkv.getString(THEME_STORAGE_KEY)
  if (!raw) return 'quietPaper'

  try {
    const parsed = JSON.parse(raw) as { state?: { themeName?: string } }
    const name = parsed?.state?.themeName
    return name === 'cleanSlate' ? 'cleanSlate' : 'quietPaper'
  } catch {
    return 'quietPaper'
  }
}

const initialThemeName = getPersistedThemeName()

interface ThemeState {
  themeName: ThemeName
  theme: Theme
  setThemeName: (name: ThemeName) => void
}

export const useThemeStore = create<ThemeState>()(
  persist(
    set => ({
      themeName: initialThemeName,
      theme: THEME_MAP[initialThemeName],
      setThemeName: (name: ThemeName) => {
        set({
          themeName: name,
          theme: THEME_MAP[name],
        })
      },
    }),
    {
      name: THEME_STORAGE_KEY,
      storage: createJSONStorage(() => mmkvZustandStorage),
      partialize: state => ({ themeName: state.themeName }),
      merge: (persistedState, currentState) => {
        const persisted = persistedState as Partial<ThemeState> | undefined
        const name: ThemeName = persisted?.themeName === 'cleanSlate' ? 'cleanSlate' : 'quietPaper'
        return {
          ...currentState,
          themeName: name,
          theme: THEME_MAP[name],
        }
      },
    }
  )
)
