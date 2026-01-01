import { useState, useCallback } from 'react'
import { aiCommands } from '@/utils/callRust'
import { loadAIConfig } from '@/utils/settings-helpers'
import { toast } from '@/hooks/use-toast'
import type {
  CompleteTextRequest,
  CompleteTextResponse,
  RewriteTextRequest,
  RewriteTextResponse,
  SummarizeTextRequest,
  SummarizeTextResponse,
  SuggestTagsRequest,
  SuggestTagsResponse,
} from '@/types/ai'

let aiConfigCache: { config: any; timestamp: number } | null = null
const CACHE_DURATION = 5 * 60 * 1000

export function useAI() {
  const [loading, setLoading] = useState(false)

  const checkAIConfig = useCallback(async (): Promise<boolean> => {
    const now = Date.now()
    if (aiConfigCache && now - aiConfigCache.timestamp < CACHE_DURATION) {
      return !!aiConfigCache.config
    }

    try {
      const config = await loadAIConfig()
      aiConfigCache = { config, timestamp: now }
      return !!config
    } catch (error) {
      console.error('Failed to check AI config:', error)
      return false
    }
  }, [])

  const completeText = useCallback(
    async (req: CompleteTextRequest): Promise<CompleteTextResponse | null> => {
      const hasConfig = await checkAIConfig()
      if (!hasConfig) {
        toast.error('AI功能未配置，请前往设置页面配置')
        return null
      }

      try {
        setLoading(true)
        const result = await aiCommands.completeText(req)
        return result
      } catch (error: any) {
        console.error('AI complete text failed:', error)
        toast.error(error?.message || '文本补全失败，请重试')
        return null
      } finally {
        setLoading(false)
      }
    },
    [checkAIConfig]
  )

  const rewriteText = useCallback(
    async (req: RewriteTextRequest): Promise<RewriteTextResponse | null> => {
      const hasConfig = await checkAIConfig()
      if (!hasConfig) {
        toast.error('AI功能未配置，请前往设置页面配置')
        return null
      }

      try {
        setLoading(true)
        const result = await aiCommands.rewriteText(req)
        return result
      } catch (error: any) {
        console.error('AI rewrite text failed:', error)
        toast.error(error?.message || '文本重写失败，请重试')
        return null
      } finally {
        setLoading(false)
      }
    },
    [checkAIConfig]
  )

  const summarizeText = useCallback(
    async (req: SummarizeTextRequest): Promise<SummarizeTextResponse | null> => {
      const hasConfig = await checkAIConfig()
      if (!hasConfig) {
        toast.error('AI功能未配置，请前往设置页面配置')
        return null
      }

      try {
        setLoading(true)
        const result = await aiCommands.summarizeText(req)
        return result
      } catch (error: any) {
        console.error('AI summarize text failed:', error)
        toast.error(error?.message || '生成总结失败，请重试')
        return null
      } finally {
        setLoading(false)
      }
    },
    [checkAIConfig]
  )

  const suggestTags = useCallback(
    async (req: SuggestTagsRequest): Promise<SuggestTagsResponse | null> => {
      const hasConfig = await checkAIConfig()
      if (!hasConfig) {
        toast.error('AI功能未配置，请前往设置页面配置')
        return null
      }

      try {
        setLoading(true)
        const result = await aiCommands.suggestTags(req)
        return result
      } catch (error: any) {
        console.error('AI suggest tags failed:', error)
        toast.error(error?.message || '标签建议失败，请重试')
        return null
      } finally {
        setLoading(false)
      }
    },
    [checkAIConfig]
  )

  const clearCache = useCallback(() => {
    aiConfigCache = null
  }, [])

  return {
    loading,
    checkAIConfig,
    completeText,
    rewriteText,
    summarizeText,
    suggestTags,
    clearCache,
  }
}
