import { RouterProvider } from "react-router-dom"
import { I18nextProvider } from "react-i18next"
import { useEffect } from "react"
import i18n from "./lib/i18n"
import { router } from "./router"
import { ToastProvider } from "./components/ui/toast"
import { TooltipProvider } from "./components/ui/tooltip"
import { useAuthStore } from "./stores/authStore"
import { useThemeStore } from "./stores/themeStore"

export default function App() {
  useEffect(() => {
    void Promise.all([
      useAuthStore.getState().init(),
      useThemeStore.getState().init(),
    ])
  }, [])

  return (
    <I18nextProvider i18n={i18n}>
      <TooltipProvider>
        <ToastProvider>
          <RouterProvider router={router} />
        </ToastProvider>
      </TooltipProvider>
    </I18nextProvider>
  )
}
