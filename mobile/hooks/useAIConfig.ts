import { getAIConfig, type AIConfig } from '@/lib/ai'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

export function useAIConfig() {
  const [config, setConfig] = useState<AIConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const unmountedRef = useRef(false)

  const loadAIConfig = useCallback(async () => {
    try {
      const loaded = await getAIConfig()
      if (!unmountedRef.current) setConfig(loaded)
    } catch (error) {
      console.error('Failed to load AI config:', error)
    } finally {
      if (!unmountedRef.current) setLoading(false)
    }
  }, [])

  useEffect(() => {
    unmountedRef.current = false
    loadAIConfig()
    return () => {
      unmountedRef.current = true
    }
  }, [loadAIConfig])

  const isAIEnabled = useMemo(() => !!config?.apiKey?.trim(), [config])

  return {
    config,
    loading,
    isAIEnabled,
    reload: loadAIConfig,
  }
}
