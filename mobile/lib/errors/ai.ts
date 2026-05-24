import i18n from '@/lib/i18n'

/**
 * Map an AI API error to a localized user-facing message.
 * Handles timeout, network, configuration, and generic errors.
 */
export function mapAIError(err: unknown): string {
  const raw = err instanceof Error ? err.message : ((err as any)?.error ?? '')
  if (!raw) return i18n.t('error.aiUnavailable')

  const message = raw.toLowerCase()

  if (message.includes('timeout') || message.includes('timed out') || raw.includes('请求超时')) {
    return i18n.t('error.aiTimeout')
  }

  if (message.includes('network') || message.includes('failed to fetch')) {
    return i18n.t('error.aiNetworkError')
  }

  if (raw.includes('not configured')) {
    return i18n.t('error.aiNotConfigured')
  }

  return raw.length > 80 ? i18n.t('error.aiGenericError') : raw
}
