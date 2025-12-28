import { create } from 'zustand'
import { persist } from 'zustand/middleware'

type Theme = 'light' | 'dark'

interface AppState {
  theme: Theme
  sidebarOpen: boolean
  setTheme: (theme: Theme, x?: number, y?: number) => void
  toggleTheme: (event?: React.MouseEvent) => void
  setSidebarOpen: (open: boolean) => void
  toggleSidebar: () => void
}

const applyTheme = (theme: Theme, x?: number, y?: number) => {
  if (typeof window === 'undefined') return

  const root = document.documentElement

  const updateTheme = () => {
    if (theme === 'dark') {
      root.classList.add('dark')
    } else {
      root.classList.remove('dark')
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
    set => ({
      theme: 'light',
      sidebarOpen: true,
      setTheme: (theme, x?: number, y?: number) => {
        set({ theme })
        applyTheme(theme, x, y)
      },
      toggleTheme: (event?: React.MouseEvent) => {
        set(state => {
          const newTheme = state.theme === 'dark' ? 'light' : 'dark'
          if (event) {
            const rect = (event.target as HTMLElement).getBoundingClientRect()
            const x = event.clientX - rect.left
            const y = event.clientY - rect.top
            applyTheme(newTheme, x, y)
          } else {
            applyTheme(newTheme)
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
        if (state) applyTheme(state.theme)
      },
    }
  )
)
