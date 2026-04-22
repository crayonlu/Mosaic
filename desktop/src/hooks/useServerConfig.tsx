import { clearAuth, initSharedApiClient } from '@/lib/sharedApi'
import type { ServerConfig } from '@/types/settings'
import { configCommands } from '@/utils/callRust'
import { useCallback, useEffect, useState } from 'react'

const SERVER_CONFIG_UPDATED_EVENT = 'mosaic:server-config-updated'

export function notifyServerConfigUpdated() {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new Event(SERVER_CONFIG_UPDATED_EVENT))
}

export function useServerConfig() {
  const [isConfigured, setIsConfigured] = useState(false)
  const [loading, setLoading] = useState(true)
  const [config, setConfig] = useState<ServerConfig | null>(null)

  const checkConfig = useCallback(async () => {
    try {
      const rawConfig = await configCommands.getServerConfig()
      const serverConfig: ServerConfig = {
        ...rawConfig,
        proxyMode: rawConfig.proxyMode || 'direct',
      }
      const configured =
        !!serverConfig.url &&
        !!serverConfig.username &&
        !!serverConfig.password &&
        !!serverConfig.apiToken

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
  }, [])

  useEffect(() => {
    checkConfig()
  }, [checkConfig])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const handleConfigUpdated = () => {
      void checkConfig()
    }
    window.addEventListener(SERVER_CONFIG_UPDATED_EVENT, handleConfigUpdated)
    return () => {
      window.removeEventListener(SERVER_CONFIG_UPDATED_EVENT, handleConfigUpdated)
    }
  }, [checkConfig])

  const logout = async () => {
    try {
      await configCommands.logout()
      await clearAuth()
      setIsConfigured(false)
      setConfig(null)
      notifyServerConfigUpdated()
    } catch (error) {
      console.error('Failed to logout:', error)
    }
  }

  return { isConfigured, loading, config, checkConfig, logout }
}
