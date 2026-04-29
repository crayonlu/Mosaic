import { create } from "zustand/react"

export type ThemeName = "quiet-paper" | "clean-slate"
export type ThemeMode = "light" | "dark"

const STORAGE_KEY_THEME = "mosaic_admin_theme"
const STORAGE_KEY_MODE = "mosaic_admin_mode"

function getStoredTheme(): ThemeName {
  const v = localStorage.getItem(STORAGE_KEY_THEME)
  if (v === "clean-slate") return "clean-slate"
  return "quiet-paper"
}

function getStoredMode(): ThemeMode | "system" {
  const v = localStorage.getItem(STORAGE_KEY_MODE)
  if (v === "light" || v === "dark") return v
  return "system"
}

function getSystemMode(): ThemeMode {
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light"
}

function applyTheme(name: ThemeName, mode: ThemeMode) {
  const root = document.documentElement
  root.setAttribute("data-theme", name)
  root.classList.remove("light", "dark")
  root.classList.add(mode)
}

interface ThemeState {
  themeName: ThemeName
  modePreference: ThemeMode | "system"
  resolvedMode: ThemeMode
  initialized: boolean
  setTheme: (name: ThemeName) => void
  setMode: (mode: ThemeMode | "system") => void
  init: () => void
}

export const useThemeStore = create<ThemeState>((set, get) => {
  const storedMode = getStoredMode()
  const initialMode: ThemeMode =
    storedMode === "system" ? getSystemMode() : storedMode

  return {
    themeName: getStoredTheme(),
    modePreference: getStoredMode(),
    resolvedMode: initialMode,
    initialized: false,

    setTheme: (name: ThemeName) => {
      localStorage.setItem(STORAGE_KEY_THEME, name)
      set({ themeName: name })
      applyTheme(name, get().resolvedMode)
    },

    setMode: (mode: ThemeMode | "system") => {
      if (mode === "system") {
        localStorage.removeItem(STORAGE_KEY_MODE)
        const sysMode = getSystemMode()
        set({ modePreference: "system", resolvedMode: sysMode })
        applyTheme(get().themeName, sysMode)
      } else {
        localStorage.setItem(STORAGE_KEY_MODE, mode)
        set({ modePreference: mode, resolvedMode: mode })
        applyTheme(get().themeName, mode)
      }
    },

    init: () => {
      if (get().initialized) return
      set({ initialized: true })
      const mq = window.matchMedia("(prefers-color-scheme: dark)")
      mq.addEventListener("change", (e) => {
        const state = get()
        if (state.modePreference === "system") {
          const newMode = e.matches ? "dark" : "light"
          set({ resolvedMode: newMode })
          applyTheme(state.themeName, newMode)
        }
      })
      applyTheme(get().themeName, get().resolvedMode)
    },
  }
})
