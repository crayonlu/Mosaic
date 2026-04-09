import type { ApiError } from '@mosaic/api'

export interface ConnectionErrorPresentation {
  title: string
  message: string
  hint?: string
}

type TauriInvokeError = {
  message?: string
  error?: string
}

function getRawErrorMessage(error: unknown): string {
  if (typeof error === 'string') {
    return error
  }

  if (error && typeof error === 'object') {
    const invokeError = error as TauriInvokeError & Partial<ApiError>
    if (typeof invokeError.error === 'string' && invokeError.error) {
      return invokeError.error
    }
    if (typeof invokeError.message === 'string' && invokeError.message) {
      return invokeError.message
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

  if (normalized.includes('error 401') || normalized.includes('unauthorized')) {
    return {
      title: '认证失败',
      message: '用户名或密码错误，请重新确认后再试。',
      hint: '如果你最近修改过密码，请使用新密码。',
    }
  }

  if (normalized.includes('error 403') || normalized.includes('forbidden')) {
    return {
      title: '权限不足',
      message: '当前账号无权访问该服务。',
      hint: '请联系管理员检查账号权限。',
    }
  }

  if (normalized.includes('error 404') || normalized.includes('not found')) {
    return {
      title: '地址不可用',
      message: '未找到服务器接口，请检查服务器地址。',
      hint: '请确认地址是否包含正确域名和端口。',
    }
  }

  if (normalized.includes('error 5')) {
    return {
      title: '服务器异常',
      message: '服务器暂时不可用，请稍后再试。',
      hint: '如持续失败，请查看服务端日志。',
    }
  }

  if (
    normalized.includes('timeout') ||
    normalized.includes('timed out') ||
    normalized.includes('deadline has elapsed')
  ) {
    return {
      title: stage === 'login' ? '登录超时' : '连接超时',
      message: '请求超时，可能是网络延迟较高或服务响应过慢。',
      hint: '请稍后重试，或检查网络和服务器负载。',
    }
  }

  if (
    normalized.includes('network error') ||
    normalized.includes('error sending request') ||
    normalized.includes('dns error') ||
    normalized.includes('connection refused') ||
    normalized.includes('failed to connect')
  ) {
    return {
      title: '网络不可达',
      message: '无法连接到服务器，请检查地址、端口和网络环境。',
      hint: 'Windows 环境下可优先检查代理、防火墙或证书链。',
    }
  }

  if (
    normalized.includes('tls') ||
    normalized.includes('certificate') ||
    normalized.includes('ssl')
  ) {
    return {
      title: '证书校验失败',
      message: 'HTTPS 证书可能无效或不受信任。',
      hint: '请更新证书后重试，或使用受信任 CA 证书。',
    }
  }

  if (stage === 'login') {
    return {
      title: '登录失败',
      message: raw || '登录失败，请检查服务器配置和账号信息。',
      hint: '建议先点击“测试连接”，确认后再登录。',
    }
  }

  if (stage === 'initialize') {
    return {
      title: '服务初始化失败',
      message: raw || '已保存配置，但初始化连接未完成。',
      hint: '请重新测试连接并检查服务端状态。',
    }
  }

  return {
    title: '连接失败',
    message: raw || '连接服务器失败，请检查配置后重试。',
    hint: '请确认 URL 可访问且服务已启动。',
  }
}
