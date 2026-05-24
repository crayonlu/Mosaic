import i18n from '@/lib/i18n'
import { aiApi } from '@mosaic/api'
import { useCallback, useState } from 'react'
import { mapAIError } from '../lib/errors/ai'
import { normalizeContent } from '../lib/utils/content'
import { useConnectionStore } from '../stores/connectionStore'

export interface TagSuggestion {
  name: string
  confidence: number
}

function mapTagSuggestionErrorMessage(err: unknown): string {
  return mapAIError(err)
}

export function useAITags() {
  const [suggestions, setSuggestions] = useState<TagSuggestion[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { isConnected } = useConnectionStore()

  const suggest = useCallback(
    async (content: string) => {
      const normalized = normalizeContent(content)
      if (!normalized) {
        setSuggestions([])
        return
      }

      if (!isConnected) {
        setError(i18n.t('error.noNetwork'))
        setSuggestions([])
        return
      }

      setLoading(true)
      setError(null)

      try {
        const response = await aiApi.suggestTags(normalized)
        if (response.tags.length === 0) {
          setSuggestions([])
          setError(i18n.t('error.aiNoTags'))
        } else {
          setError(null)
          setSuggestions(response.tags.map(name => ({ name, confidence: 0.8 })))
        }
      } catch (err) {
        setError(mapTagSuggestionErrorMessage(err))
        setSuggestions([])
      } finally {
        setLoading(false)
      }
    },
    [isConnected]
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
    disabled: !isConnected,
  }
}
