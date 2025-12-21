import { create } from 'zustand'
import { persist } from 'zustand/middleware'

type Theme = 'light' | 'dark'

interface AppState {
  theme: Theme
  sidebarOpen: boolean
  setTheme: (theme: Theme) => void
  toggleTheme: () => void
  setSidebarOpen: (open: boolean) => void
  toggleSidebar: () => void
}

const applyTheme = (theme: Theme) => {
  if (typeof window === 'undefined') return
  const root = document.documentElement
  if (theme === 'dark') {
    root.classList.add('dark')
  } else {
    root.classList.remove('dark')
  }
}

export const useAppStore = create<AppState>()(
  persist(
    set => ({
      theme: 'light',
      sidebarOpen: true,
      setTheme: theme => {
        set({ theme })
        applyTheme(theme)
      },
      toggleTheme: () => {
        set(state => {
          const newTheme = state.theme === 'dark' ? 'light' : 'dark'
          applyTheme(newTheme)
          return { theme: newTheme }
        })
      },
      setSidebarOpen: open => set({ sidebarOpen: open }),
      toggleSidebar: () => set(state => ({ sidebarOpen: !state.sidebarOpen })),
    }),
    {
      name: 'app-storage',
      onRehydrateStorage: () => state => {
        if (state) applyTheme(state.theme)
      },
    }
  )
)
