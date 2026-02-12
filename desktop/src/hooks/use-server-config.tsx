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
      setConfig(serverConfig)
      setIsConfigured(configured)
    } catch (error) {
      console.error('Failed to check server config:', error)
      setIsConfigured(false)
    } finally {
      setLoading(false)
    }
  }

  const Logout = async () => {
    try {
      await configCommands.logout()
      setIsConfigured(false)
      setConfig(null)
    } catch (error) {
      console.error('Failed to logout:', error)
    }
  }

  return { isConfigured, loading, config, checkConfig, Logout }
}
