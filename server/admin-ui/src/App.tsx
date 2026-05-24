import { useEffect } from "react"
import { I18nextProvider } from "react-i18next"
import { RouterProvider } from "react-router-dom"
import ToastProvider from "./components/ToastProvider"
import i18n from "./lib/i18n"
import { router } from "./router"
import { useAuthStore } from "./stores/authStore"
import { useThemeStore } from "./stores/themeStore"

export default function App() {
  const authInit = useAuthStore((s) => s.init)
  const themeInit = useThemeStore((s) => s.init)

  useEffect(() => {
    void (async () => {
      await Promise.all([authInit(), themeInit()])
    })()
  }, [authInit, themeInit])

  return (
    <I18nextProvider i18n={i18n}>
      <RouterProvider router={router} />
      <ToastProvider />
    </I18nextProvider>
  )
}
