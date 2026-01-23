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
      setConfig(serverConfig)
      setIsConfigured(!!serverConfig.url && !!serverConfig.username && !!serverConfig.password)
    } catch (error) {
      console.error('Failed to check server config:', error)
      setIsConfigured(false)
    } finally {
      setLoading(false)
    }
  }

  return { isConfigured, loading, config, checkConfig }
}
