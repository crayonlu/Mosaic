import { create } from 'zustand'
import { persist } from 'zustand/middleware'

type ColorMode = 'light' | 'dark'
type ThemeName = 'quietPaper' | 'cleanSlate'
type Theme = ColorMode // kept for backward compat; represents color mode

interface AppState {
  theme: Theme
  themeName: ThemeName
  sidebarOpen: boolean
  setTheme: (theme: Theme, x?: number, y?: number) => void
  setThemeName: (name: ThemeName) => void
  toggleTheme: (event?: React.MouseEvent) => void
  setSidebarOpen: (open: boolean) => void
  toggleSidebar: () => void
}

const applyTheme = (theme: Theme, themeName?: ThemeName, x?: number, y?: number) => {
  if (typeof window === 'undefined') return

  const root = document.documentElement

  const updateTheme = () => {
    if (theme === 'dark') {
      root.classList.add('dark')
    } else {
      root.classList.remove('dark')
    }
    if (themeName === 'cleanSlate') {
      root.classList.add('clean-slate')
    } else {
      root.classList.remove('clean-slate')
    }
  }

  if (x !== undefined && y !== undefined && 'startViewTransition' in document) {
    root.style.setProperty('--x', `${x}px`)
    root.style.setProperty('--y', `${y}px`)
    document.startViewTransition(updateTheme)
  } else {
    updateTheme()
  }
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      theme: 'light',
      themeName: 'quietPaper',
      sidebarOpen: true,
      setTheme: (theme, x?: number, y?: number) => {
        set({ theme })
        applyTheme(theme, get().themeName, x, y)
      },
      setThemeName: (name: ThemeName) => {
        set({ themeName: name })
        applyTheme(get().theme, name)
      },
      toggleTheme: (event?: React.MouseEvent) => {
        set(state => {
          const newTheme = state.theme === 'dark' ? 'light' : 'dark'
          if (event) {
            const rect = (event.target as HTMLElement).getBoundingClientRect()
            const x = event.clientX - rect.left
            const y = event.clientY - rect.top
            applyTheme(newTheme, state.themeName, x, y)
          } else {
            applyTheme(newTheme, state.themeName)
          }
          return { theme: newTheme }
        })
      },
      setSidebarOpen: open => set({ sidebarOpen: open }),
      toggleSidebar: () => set(state => ({ sidebarOpen: !state.sidebarOpen })),
    }),
    {
      name: 'app-storage',
      onRehydrateStorage: () => state => {
        if (state) applyTheme(state.theme, state.themeName)
      },
    }
  )
)
