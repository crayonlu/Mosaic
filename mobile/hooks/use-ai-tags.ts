import { useCallback, useState } from 'react'
import { createAIClient, type TagSuggestion } from '../lib/ai'
import { useConnectionStore } from '../stores/connection-store'
import { useAIConfig } from './use-ai-config'

export function useAITags() {
  const [suggestions, setSuggestions] = useState<TagSuggestion[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { isConnected } = useConnectionStore()
  const { isAIEnabled } = useAIConfig()

  const suggest = useCallback(
    async (content: string) => {
      if (!content.trim()) {
        setSuggestions([])
        return
      }

      if (!isConnected) {
        setError('无网络连接')
        return
      }

      if (!isAIEnabled) {
        setError('请先在设置中配置 AI')
        return
      }

      setLoading(true)
      setError(null)

      try {
        const client = await createAIClient()
        const response = await client.suggestTags(content)
        setSuggestions(response.data)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'AI 服务错误')
        setSuggestions([])
      } finally {
        setLoading(false)
      }
    },
    [isConnected, isAIEnabled]
  )

  const clear = useCallback(() => {
    setSuggestions([])
    setError(null)
  }, [])

  return {
    suggestions,
    loading,
    error,
    suggest,
    clear,
    disabled: !isConnected || !isAIEnabled,
  }
}
