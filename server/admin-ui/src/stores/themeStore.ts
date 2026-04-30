import { create } from "zustand/react"

export type ThemeMode = "light" | "dark"

const STORAGE_KEY_MODE = "mosaic_admin_mode"

function getStoredMode(): ThemeMode | "system" {
  const v = localStorage.getItem(STORAGE_KEY_MODE)
  if (v === "light" || v === "dark") return v
  return "system"
}

function getSystemMode(): ThemeMode {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
}

function applyMode(mode: ThemeMode) {
  const root = document.documentElement
  if (mode === "dark") {
    root.classList.add("dark")
  } else {
    root.classList.remove("dark")
  }
}

interface ThemeState {
  modePreference: ThemeMode | "system"
  resolvedMode: ThemeMode
  initialized: boolean
  setMode: (mode: ThemeMode | "system") => void
  init: () => void
}

export const useThemeStore = create<ThemeState>((set, get) => {
  const storedMode = getStoredMode()
  const initialMode: ThemeMode = storedMode === "system" ? getSystemMode() : storedMode

  return {
    modePreference: storedMode,
    resolvedMode: initialMode,
    initialized: false,

    setMode: (mode: ThemeMode | "system") => {
      if (mode === "system") {
        localStorage.removeItem(STORAGE_KEY_MODE)
        const sysMode = getSystemMode()
        set({ modePreference: "system", resolvedMode: sysMode })
        applyMode(sysMode)
      } else {
        localStorage.setItem(STORAGE_KEY_MODE, mode)
        set({ modePreference: mode, resolvedMode: mode })
        applyMode(mode)
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
          applyMode(newMode)
        }
      })
      applyMode(get().resolvedMode)
    },
  }
})
