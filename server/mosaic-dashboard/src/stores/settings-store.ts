import type { AIConfig, ShortcutConfig } from '@/types/settings'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface SettingsState {
  aiConfig: AIConfig | null
  shortcutConfig: ShortcutConfig | null
  autostartEnabled: boolean
  setAIConfig: (config: AIConfig | null) => void
  setShortcutConfig: (config: ShortcutConfig | null) => void
  setAutostartEnabled: (enabled: boolean) => void
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    set => ({
      aiConfig: null,
      shortcutConfig: null,
      autostartEnabled: false,
      setAIConfig: config => set({ aiConfig: config }),
      setShortcutConfig: config => set({ shortcutConfig: config }),
      setAutostartEnabled: enabled => set({ autostartEnabled: enabled }),
    }),
    {
      name: 'settings-storage',
    }
  )
)
