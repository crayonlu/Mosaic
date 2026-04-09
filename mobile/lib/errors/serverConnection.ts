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
    return '请输入服务器地址'
  }

  let parsed: URL
  try {
    parsed = new URL(normalizedUrl)
  } catch {
    return '服务器地址格式无效，请输入完整 URL（例如 https://example.com）'
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return '服务器地址必须以 http:// 或 https:// 开头'
  }

  if (!parsed.hostname) {
    return '服务器地址缺少域名或 IP'
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
      title: '认证失败',
      message: '用户名或密码错误，请重新确认后再试。',
      hint: '如果你刚修改过密码，请使用新密码登录。',
    }
  }

  if (apiError?.status === 403) {
    return {
      title: '权限不足',
      message: '当前账号没有访问服务器的权限。',
      hint: '请确认账号角色，或联系管理员开通权限。',
    }
  }

  if (apiError?.status === 404) {
    return {
      title: '地址不可用',
      message: '未找到服务器接口，请检查服务器地址是否正确。',
      hint: '示例: https://your-domain.com',
    }
  }

  if (apiError?.status && apiError.status >= 500) {
    return {
      title: '服务器异常',
      message: '服务器暂时不可用，请稍后再试。',
      hint: '若持续失败，请检查服务端日志。',
    }
  }

  if (
    normalized.includes('abort') ||
    normalized.includes('timeout') ||
    normalized.includes('timed out')
  ) {
    return {
      title: stage === 'login' ? '登录超时' : '连接超时',
      message: '请求超时，可能是网络不稳定或服务器响应较慢。',
      hint: '请检查网络后重试，必要时稍后再试。',
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
      title: '网络不可达',
      message: '无法连接到服务器，请确认地址和网络环境。',
      hint: '请检查同一网络下是否能访问该服务器。',
    }
  }

  if (
    normalized.includes('ssl') ||
    normalized.includes('tls') ||
    normalized.includes('certificate')
  ) {
    return {
      title: '证书校验失败',
      message: '连接使用的 HTTPS 证书可能无效或不受信任。',
      hint: '请检查服务器证书配置，或更换可信证书。',
    }
  }

  if (stage === 'login') {
    return {
      title: '登录失败',
      message: raw || '登录失败，请检查服务器地址和账号信息。',
      hint: '请先测试连接成功，再尝试登录。',
    }
  }

  if (stage === 'initialize') {
    return {
      title: '服务初始化失败',
      message: raw || '已登录，但启动时未能连接服务器。',
      hint: '应用可继续使用，本地内容不受影响。',
    }
  }

  return {
    title: '连接失败',
    message: raw || '无法连接服务器，请检查配置后重试。',
    hint: '请确认 URL 是否可访问，并检查服务器是否在线。',
  }
}
