import { clearAuth, initSharedApiClient } from '@/lib/shared-api'
import type { ServerConfig } from '@/types/settings'
import { configCommands } from '@/utils/call-rust'
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

      // Only initialize API client if we have a valid URL
      if (serverConfig.url) {
        initSharedApiClient(serverConfig.url)
      }

      setConfig(serverConfig)
      setIsConfigured(configured)
    } catch (error) {
      console.error('Failed to check server config:', error)
      setIsConfigured(false)
    } finally {
      setLoading(false)
    }
  }

  const logout = async () => {
    try {
      await configCommands.logout()
      await clearAuth()
      setIsConfigured(false)
      setConfig(null)
    } catch (error) {
      console.error('Failed to logout:', error)
    }
  }

  return { isConfigured, loading, config, checkConfig, logout }
}
