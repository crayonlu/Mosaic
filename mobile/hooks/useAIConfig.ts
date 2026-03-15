import { getAIConfig, type AIConfig } from '@/lib/ai'
import { useEffect, useState } from 'react'

export function useAIConfig() {
  const [config, setConfig] = useState<AIConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [isAIEnabled, setIsAIEnabled] = useState(false)

  useEffect(() => {
    loadAIConfig()
  }, [])

  const loadAIConfig = async () => {
    try {
      const config = await getAIConfig()
      setConfig(config)
      setIsAIEnabled(!!config.apiKey?.trim())
    } catch (error) {
      console.error('Failed to load AI config:', error)
      setIsAIEnabled(false)
    } finally {
      setLoading(false)
    }
  }

  return {
    config,
    loading,
    isAIEnabled,
    reload: loadAIConfig,
  }
}
