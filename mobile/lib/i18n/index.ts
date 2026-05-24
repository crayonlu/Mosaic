import * as Localization from 'expo-localization'
import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import en from './en.json'
import zh from './zh.json'

export type SupportedLocale = 'en' | 'zh'

const resources = {
  en: { translation: en },
  zh: { translation: zh },
} as const

i18n.use(initReactI18next).init({
  resources,
  lng: Localization.getLocales()?.[0]?.languageCode === 'zh' ? 'zh' : 'en',
  fallbackLng: 'en',
  interpolation: {
    escapeValue: false,
  },
  compatibilityJSON: 'v4',
})

export default i18n
