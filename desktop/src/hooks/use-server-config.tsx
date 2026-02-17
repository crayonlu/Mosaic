import { clearStoredAuth, initSharedApiClient, setStoredAuthTokens } from '@/lib/shared-api'
import type { ServerConfig } from '@/types/settings'
import { configCommands } from '@/utils/callRust'
import { useEffect, useState } from 'react'

export function useServerConfig() {
  const [isConfigured, setIsConfigured] = useState(false)
  const [loading, setLoading] = useState(true)
  const [config, setConfig] = useState<ServerConfig | null>(null)

  useEffect(() => {
    checkConfig()
  }, [])

  const checkConfig = async () => {
    try {
      const serverConfig = await configCommands.getServerConfig()
      const configured = !!serverConfig.url && !!serverConfig.username && !!serverConfig.password
      initSharedApiClient(serverConfig.url)
      if (serverConfig.apiToken && serverConfig.refreshToken) {
        setStoredAuthTokens(serverConfig.apiToken, serverConfig.refreshToken)
      }
      setConfig(serverConfig)
      setIsConfigured(configured)
    } catch (error) {
      console.error('Failed to check server config:', error)
      initSharedApiClient()
      setIsConfigured(false)
    } finally {
      setLoading(false)
    }
  }

  const Logout = async () => {
    try {
      await configCommands.logout()
      await clearStoredAuth()
      setIsConfigured(false)
      setConfig(null)
    } catch (error) {
      console.error('Failed to logout:', error)
    }
  }

  return { isConfigured, loading, config, checkConfig, Logout }
}
