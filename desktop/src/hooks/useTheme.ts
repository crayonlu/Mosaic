import { useAppStore } from '@/stores/appStore'

export function useTheme() {
  const theme = useAppStore(state => state.theme)
  const themeName = useAppStore(state => state.themeName)
  const toggleTheme = useAppStore(state => state.toggleTheme)
  const setTheme = useAppStore(state => state.setTheme)
  const setThemeName = useAppStore(state => state.setThemeName)

  return { theme, themeName, toggleTheme, setTheme, setThemeName }
}
