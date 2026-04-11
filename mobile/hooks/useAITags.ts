import { useCallback, useState } from 'react'
import { createAIClient, type TagSuggestion } from '../lib/ai'
import { normalizeContent } from '../lib/utils/content'
import { useConnectionStore } from '../stores/connectionStore'
import { useAIConfig } from './useAIConfig'

function mapTagSuggestionErrorMessage(err: unknown): string {
  if (!(err instanceof Error)) {
    return 'AI 服务暂时不可用，请稍后重试'
  }

  const raw = err.message || ''
  const message = raw.toLowerCase()

  if (message.includes('timeout') || message.includes('timed out') || raw.includes('请求超时')) {
    return 'AI 请求超时，请稍后重试'
  }

  if (message.includes('401') || message.includes('unauthorized')) {
    return 'AI 鉴权失败，请检查 API Key 是否正确'
  }

  if (message.includes('403') || message.includes('forbidden')) {
    return 'AI 请求被拒绝，请检查 API 权限配置'
  }

  if (message.includes('404') || message.includes('not found')) {
    return 'AI 接口地址不可用，请检查 Base URL'
  }

  if (message.includes('429') || message.includes('rate limit') || message.includes('quota')) {
    return 'AI 请求过于频繁或额度不足，请稍后再试'
  }

  if (message.includes('network') || message.includes('failed to fetch')) {
    return '网络异常，无法连接 AI 服务'
  }

  if (raw.includes('AI 返回空内容')) {
    return 'AI 未返回有效标签，请稍后重试'
  }

  return raw.length > 80 ? 'AI 服务异常，请检查配置后重试' : raw
}

export function useAITags() {
  const [suggestions, setSuggestions] = useState<TagSuggestion[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { isConnected } = useConnectionStore()
  const { isAIEnabled } = useAIConfig()

  const suggest = useCallback(
    async (content: string) => {
      const normalized = normalizeContent(content)
      if (!normalized) {
        setSuggestions([])
        return
      }

      if (!isConnected) {
        setError('无网络连接')
        setSuggestions([])
        return
      }

      if (!isAIEnabled) {
        setError('请先在设置中配置 AI')
        setSuggestions([])
        return
      }

      setLoading(true)
      setError(null)

      try {
        const client = await createAIClient()
        const response = await client.suggestTags(normalized)
        if (response.data.length === 0) {
          setError('AI 暂未生成标签建议，请稍后重试')
        }
        setSuggestions(response.data)
      } catch (err) {
        setError(mapTagSuggestionErrorMessage(err))
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
