import { useEffect } from 'react'
import { RouterProvider } from 'react-router-dom'
import ToastProvider from './components/ToastProvider'
import { router } from './router'
import { useAuthStore } from './stores/authStore'
import { useThemeStore } from './stores/themeStore'

export default function App() {
  const authInit = useAuthStore((s) => s.init)
  const themeInit = useThemeStore((s) => s.init)

  useEffect(() => {
    void (async () => {
      await Promise.all([authInit(), themeInit()])
    })()
  }, [authInit, themeInit])

  return (
    <>
      <RouterProvider router={router} />
      <ToastProvider />
    </>
  )
}
