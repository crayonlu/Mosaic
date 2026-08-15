import i18n from "i18next"
import { initReactI18next } from "react-i18next"
import en from "../../locales/en.json"
import zh from "../../locales/zh.json"

const LOCALE_KEY = "admin-ui-locale"

function detectInitial() {
  const stored = localStorage.getItem(LOCALE_KEY)
  if (stored === "zh" || stored === "en") return stored
  return navigator.language.toLowerCase().startsWith("zh") ? "zh" : "en"
}

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    zh: { translation: zh },
  },
  lng: detectInitial(),
  fallbackLng: "en",
  interpolation: { escapeValue: false },
})

i18n.on("languageChanged", (lng) => {
  document.documentElement.lang = lng === "zh" ? "zh-CN" : "en"
  localStorage.setItem(LOCALE_KEY, lng)
})

export default i18n
