import { useCallback, useState } from 'react'
import { createAIClient } from '../lib/ai'
import { normalizeContent } from '../lib/utils/content'
import { useConnectionStore } from '../stores/connectionStore'
import { useAIConfig } from './useAIConfig'

export interface AISummaryResult {
  summary: string
  usage: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
}

export function useAISummary() {
  const [summary, setSummary] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { isConnected } = useConnectionStore()
  const { isAIEnabled } = useAIConfig()

  const summarize = useCallback(
    async (content: string, maxLength?: number) => {
      const normalized = normalizeContent(content)
      if (!normalized) {
        setSummary(null)
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
        const response = await client.summarizeText(normalized)
        if (!response.data || response.data.trim() === '') {
          setError('AI 未返回摘要内容，请检查配置')
          setSummary(null)
        } else {
          setSummary(response.data)
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'AI 服务错误')
        setSummary(null)
      } finally {
        setLoading(false)
      }
    },
    [isConnected, isAIEnabled]
  )

  const clear = useCallback(() => {
    setSummary(null)
    setError(null)
  }, [])

  return {
    summary,
    loading,
    error,
    summarize,
    clear,
    disabled: !isConnected || !isAIEnabled,
  }
}
