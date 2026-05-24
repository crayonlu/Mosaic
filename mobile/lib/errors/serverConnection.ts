import i18n from '@/lib/i18n'
import type { ApiError } from '@mosaic/api'

export interface ConnectionErrorPresentation {
  title: string
  message: string
  hint?: string
}

function getRawErrorMessage(error: unknown): string {
  if (typeof error === 'string') {
    return error
  }

  if (error && typeof error === 'object') {
    const maybeApiError = error as Partial<ApiError> & { message?: string }
    if (typeof maybeApiError.error === 'string' && maybeApiError.error) {
      return maybeApiError.error
    }
    if (typeof maybeApiError.message === 'string' && maybeApiError.message) {
      return maybeApiError.message
    }
  }

  return ''
}

export function normalizeServerUrlInput(url: string): string {
  return url.trim().replace(/\/$/, '')
}

export function validateServerUrl(url: string): string | null {
  const normalizedUrl = normalizeServerUrlInput(url)
  if (!normalizedUrl) {
    return i18n.t('error.urlRequired')
  }

  let parsed: URL
  try {
    parsed = new URL(normalizedUrl)
  } catch {
    return i18n.t('error.urlInvalidFormat')
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return i18n.t('error.urlProtocol')
  }

  if (!parsed.hostname) {
    return i18n.t('error.urlHostname')
  }

  return null
}

export function mapServerConnectionError(
  error: unknown,
  stage: 'connect' | 'login' | 'initialize'
): ConnectionErrorPresentation {
  const raw = getRawErrorMessage(error)
  const normalized = raw.toLowerCase()
  const apiError = error as Partial<ApiError>

  if (apiError?.status === 401) {
    return {
      title: i18n.t('error.authFailed'),
      message: i18n.t('error.authFailedMsg'),
      hint: '',
    }
  }

  if (apiError?.status === 403) {
    return {
      title: i18n.t('error.noPermission'),
      message: i18n.t('error.noPermissionHint'),
      hint: '',
    }
  }

  if (apiError?.status === 404) {
    return {
      title: i18n.t('error.serverError'),
      message: i18n.t('error.noEndpoint'),
      hint: i18n.t('error.urlHint'),
    }
  }

  if (apiError?.status && apiError.status >= 500) {
    return {
      title: i18n.t('error.serverError'),
      message: i18n.t('error.serverUnavailable'),
      hint: i18n.t('error.persistHint'),
    }
  }

  if (
    normalized.includes('abort') ||
    normalized.includes('timeout') ||
    normalized.includes('timed out')
  ) {
    return {
      title: stage === 'login' ? i18n.t('error.loginTimeout') : i18n.t('error.timeout'),
      message: i18n.t('error.timeoutMsg'),
      hint: i18n.t('error.timeoutHint'),
    }
  }

  if (
    normalized.includes('failed to fetch') ||
    normalized.includes('network request failed') ||
    normalized.includes('network error') ||
    normalized.includes('econnrefused') ||
    normalized.includes('enotfound')
  ) {
    return {
      title: i18n.t('error.networkUnreachable'),
      message: i18n.t('error.connectFailedMsg'),
      hint: i18n.t('error.networkHint'),
    }
  }

  if (
    normalized.includes('ssl') ||
    normalized.includes('tls') ||
    normalized.includes('certificate')
  ) {
    return {
      title: i18n.t('error.certFailed'),
      message: i18n.t('error.certFailedMsg'),
      hint: i18n.t('error.certFailedHint'),
    }
  }

  if (stage === 'login') {
    return {
      title: i18n.t('error.loginFailed'),
      message: raw || i18n.t('error.loginFailedMsg'),
      hint: i18n.t('error.loginFailedHint'),
    }
  }

  if (stage === 'initialize') {
    return {
      title: i18n.t('error.initFailed'),
      message: raw || i18n.t('error.initFailedMsg'),
      hint: i18n.t('error.initFailedHint'),
    }
  }

  return {
    title: i18n.t('error.connectFailed'),
    message: raw || i18n.t('error.connectFailedDefault'),
    hint: i18n.t('error.checkUrlHint'),
  }
}
