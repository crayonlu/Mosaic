import i18n, { type SupportedLocale } from '@/lib/i18n'
import { mmkvZustandStorage } from '@/lib/storage/mmkv'
import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

interface LocaleState {
  locale: SupportedLocale
  setLocale: (locale: SupportedLocale) => void
}

export const useLocaleStore = create<LocaleState>()(
  persist(
    (set, get) => ({
      locale: 'en',
      setLocale: (locale: SupportedLocale) => {
        i18n.changeLanguage(locale)
        set({ locale })
      },
    }),
    {
      name: 'mosaic-locale-storage',
      storage: createJSONStorage(() => mmkvZustandStorage),
      partialize: state => ({ locale: state.locale }),
      onRehydrateStorage: () => state => {
        if (state?.locale) {
          i18n.changeLanguage(state.locale)
        }
      },
    }
  )
)
