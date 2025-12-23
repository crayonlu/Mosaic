import { useAppStore } from '@/stores/app-store'

export function useTheme() {
  const theme = useAppStore(state => state.theme)
  const toggleTheme = useAppStore(state => state.toggleTheme)
  const setTheme = useAppStore(state => state.setTheme)

  return { theme, toggleTheme, setTheme }
}
