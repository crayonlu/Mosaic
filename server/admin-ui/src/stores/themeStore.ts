import { create } from "zustand/react"

export type ThemePreference = "system" | "light" | "dark"

const THEME_KEY = "mosaic_admin_theme"

function applyTheme(pref: ThemePreference) {
  const root = document.documentElement
  if (pref === "system") {
    root.removeAttribute("data-theme")
  } else {
    root.setAttribute("data-theme", pref)
  }
}

interface ThemeState {
  preference: ThemePreference
  setPreference: (p: ThemePreference) => void
  cycle: () => void
  init: () => void
}

const ORDER: ThemePreference[] = ["system", "light", "dark"]

export const useThemeStore = create<ThemeState>((set, get) => ({
  preference: "system",

  setPreference: (p) => {
    localStorage.setItem(THEME_KEY, p)
    applyTheme(p)
    set({ preference: p })
  },

  cycle: () => {
    const current = get().preference
    const next = ORDER[(ORDER.indexOf(current) + 1) % ORDER.length]
    get().setPreference(next)
  },

  init: () => {
    const stored = localStorage.getItem(THEME_KEY)
    const pref: ThemePreference =
      stored === "light" || stored === "dark" ? stored : "system"
    applyTheme(pref)
    set({ preference: pref })
  },
}))
