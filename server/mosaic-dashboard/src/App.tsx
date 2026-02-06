import { Dashboard } from '@/pages/Dashboard'
import { useEffect, useState } from 'react'
import { Toaster } from './components/ui/toaster'
import { apiClient } from './lib/api-client'
import { Login } from './pages/Login'
import type { User } from './types/api'

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('accessToken')
      if (token) {
        try {
          const user = await apiClient.getCurrentUser()
          setUser(user)
          setIsAuthenticated(true)
        } catch (error) {
          console.error('auth: ', error)
          localStorage.removeItem('accessToken')
          localStorage.removeItem('refreshToken')
          setIsAuthenticated(false)
        }
      }
      setLoading(false)
    }

    checkAuth()
  }, [])

  const handleLogin = async (serverUrl: string, username: string, password: string) => {
    const response = await apiClient.login(serverUrl, username, password)
    setUser(response.user)
    setIsAuthenticated(true)
  }

  const handleLogout = () => {
    apiClient.clearAuth()
    setUser(null)
    setIsAuthenticated(false)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-stone-900 dark:border-stone-100"></div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return (
      <>
        <Login onLogin={handleLogin} />
        <Toaster />
      </>
    )
  }

  return (
    <>
      <Dashboard onLogout={handleLogout} />
      <Toaster />
    </>
  )
}

export default App
