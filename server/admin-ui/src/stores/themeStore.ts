import { create } from "zustand"

export type ThemeName = "quietPaper" | "cleanSlate"

interface ThemeState {
  themeName: ThemeName
  setThemeName: (name: ThemeName) => void
  init: () => void
}

const STORAGE_KEY = "mosaic_admin_theme"

export const useThemeStore = create<ThemeState>((set) => ({
  themeName: "quietPaper",
  setThemeName: (name) => {
    document.documentElement.setAttribute("data-theme", name)
    localStorage.setItem(STORAGE_KEY, name)
    set({ themeName: name })
  },
  init: () => {
    const saved = localStorage.getItem(STORAGE_KEY) as ThemeName | null
    const name: ThemeName = saved === "cleanSlate" ? "cleanSlate" : "quietPaper"
    document.documentElement.setAttribute("data-theme", name)
    set({ themeName: name })
  },
}))
