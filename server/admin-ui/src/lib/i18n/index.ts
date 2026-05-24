import i18n from "i18next"
import { initReactI18next } from "react-i18next"
import en from "../../locales/en.json"
import zh from "../../locales/zh.json"

const resources = {
  en: { translation: en },
  zh: { translation: zh },
} as const

let storedLocale: string | null = null
try {
  storedLocale = localStorage.getItem("admin-ui-locale")
} catch {
  /* ignore */
}

i18n.use(initReactI18next).init({
  resources,
  lng: storedLocale || (navigator.language.startsWith("zh") ? "zh" : "en"),
  fallbackLng: "en",
  interpolation: {
    escapeValue: false,
  },
})

export default i18n
