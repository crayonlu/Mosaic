import { getAIConfig, type AIConfig } from '@/lib/ai'
import { useCallback, useEffect, useMemo, useState } from 'react'

export function useAIConfig() {
  const [config, setConfig] = useState<AIConfig | null>(null)
  const [loading, setLoading] = useState(true)

  const loadAIConfig = useCallback(async () => {
    try {
      const loaded = await getAIConfig()
      setConfig(loaded)
    } catch (error) {
      console.error('Failed to load AI config:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadAIConfig()
  }, [loadAIConfig])

  const isAIEnabled = useMemo(() => !!config?.apiKey?.trim(), [config])

  return {
    config,
    loading,
    isAIEnabled,
    reload: loadAIConfig,
  }
}
