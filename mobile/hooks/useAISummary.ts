import i18n from '@/lib/i18n'
import { aiApi } from '@mosaic/api'
import { useCallback, useState } from 'react'
import { mapAIError } from '../lib/errors/ai'
import { normalizeContent } from '../lib/utils/content'
import { useConnectionStore } from '../stores/connectionStore'

export interface AISummaryResult {
  summary: string
}

export function useAISummary() {
  const [summary, setSummary] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { isConnected } = useConnectionStore()

  const summarize = useCallback(
    async (content: string, _maxLength?: number) => {
      const normalized = normalizeContent(content)
      if (!normalized) {
        setSummary(null)
        return
      }

      if (!isConnected) {
        setError(i18n.t('error.noNetwork'))
        return
      }

      setLoading(true)
      setError(null)

      try {
        const response = await aiApi.summarize(normalized)
        if (!response.summary || response.summary.trim() === '') {
          setError(i18n.t('error.aiEmptyResponse'))
          setSummary(null)
        } else {
          setSummary(response.summary)
        }
      } catch (err) {
        setError(mapAIError(err))
        setSummary(null)
      } finally {
        setLoading(false)
      }
    },
    [isConnected]
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
    disabled: !isConnected,
  }
}
