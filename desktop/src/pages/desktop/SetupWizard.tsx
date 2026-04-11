import DarkMosaicIcon from '@/assets/mosaic-dark.svg'
import LightMosaicIcon from '@/assets/mosaic-light.svg'
import { AuthImage } from '@/components/common/AuthImage'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useServerConfig } from '@/hooks/useServerConfig'
import { useTheme } from '@/hooks/useTheme'
import { toast } from '@/hooks/useToast'
import {
  mapServerConnectionError,
  normalizeServerUrlInput,
  validateServerUrl,
} from '@/lib/serverConnectionError'
import { initSharedApiClient } from '@/lib/sharedApi'
import type { ServerConfig } from '@/types/settings'
import { configCommands } from '@/utils/callRust'
import { ArrowRight, Check, Loader2, X } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

export default function SetupWizard() {
  const navigate = useNavigate()
  const { theme } = useTheme()
  const { checkConfig } = useServerConfig()
  const [loading, setLoading] = useState(false)
  const [testingConnection, setTestingConnection] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState('')
  const [errorHint, setErrorHint] = useState('')

  const [serverConfig, setServerConfig] = useState<ServerConfig>({
    url: '',
    username: '',
    password: '',
    aiProvider: 'openai',
    aiBaseUrl: '',
    aiApiKey: '',
  })

  const handleServerConfigChange = (field: keyof ServerConfig, value: string) => {
    setServerConfig(prev => ({ ...prev, [field]: value }))
    setConnectionStatus('idle')
    setErrorMessage('')
    setErrorHint('')
  }

  const testConnection = async () => {
    const normalizedUrl = normalizeServerUrlInput(serverConfig.url)
    const urlError = validateServerUrl(normalizedUrl)
    if (urlError) {
      setConnectionStatus('error')
      setErrorMessage(urlError)
      setErrorHint('请使用完整地址，例如 https://your-server.com')
      return
    }

    setTestingConnection(true)
    setConnectionStatus('idle')
    setErrorMessage('')
    setErrorHint('')

    const normalizedConfig = {
      ...serverConfig,
      url: normalizedUrl,
    }

    try {
      await configCommands.testServerConnection(normalizedConfig)
      setConnectionStatus('success')
      toast.success('服务器连接测试通过')
    } catch (error: unknown) {
      const presentation = mapServerConnectionError(error, 'connect')
      setConnectionStatus('error')
      setErrorMessage(presentation.message)
      setErrorHint(presentation.hint || '')
      toast.error(`${presentation.title}: ${presentation.message}`)
    } finally {
      setTestingConnection(false)
    }
  }

  const saveServerConfig = async () => {
    const normalizedUrl = normalizeServerUrlInput(serverConfig.url)
    const urlError = validateServerUrl(normalizedUrl)
    if (urlError) {
      setConnectionStatus('error')
      setErrorMessage(urlError)
      setErrorHint('请先修正服务器地址，再继续保存。')
      return
    }

    setLoading(true)
    const normalizedConfig = {
      ...serverConfig,
      url: normalizedUrl,
    }

    try {
      await configCommands.setServerConfig(normalizedConfig)

      await configCommands.login(normalizedConfig.username, normalizedConfig.password)

      initSharedApiClient(normalizedConfig.url)

      toast.success('服务器配置已保存')

      await checkConfig()

      window.location.reload()
      navigate('/')
    } catch (error: unknown) {
      const presentation = mapServerConnectionError(error, 'login')
      setConnectionStatus('error')
      setErrorMessage(presentation.message)
      setErrorHint(presentation.hint || '')
      toast.error(`${presentation.title}: ${presentation.message}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-linear-to-br from-background to-card p-4">
      <div className="w-full max-w-2xl space-y-8">
        {/* Header */}
        <div className="text-center flex flex-col items-center gap-4">
          <AuthImage
            src={theme === 'dark' ? DarkMosaicIcon : LightMosaicIcon}
            alt="Mosaic"
            className="size-32 h-auto"
            withAuth={false}
          />
          <p className="text-muted-foreground">完成初始化配置，开始您的智能笔记之旅</p>
        </div>

        {/* Server Config */}
        <Card>
          <CardHeader>
            <CardTitle>服务器配置</CardTitle>
            <CardDescription>输入您的 Mosaic 服务器信息</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="url">服务器地址</Label>
              <Input
                id="url"
                type="url"
                placeholder="https://your-server.com"
                value={serverConfig.url}
                onChange={e => handleServerConfigChange('url', e.target.value)}
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="username">用户名</Label>
              <Input
                id="username"
                type="text"
                placeholder="your-username"
                value={serverConfig.username}
                onChange={e => handleServerConfigChange('username', e.target.value)}
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">密码</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={serverConfig.password}
                onChange={e => handleServerConfigChange('password', e.target.value)}
                disabled={loading}
              />
            </div>

            {connectionStatus === 'error' && (
              <div className="p-3 rounded-md bg-destructive/10 text-destructive text-sm">
                <div className="flex items-center gap-2">
                  <X className="h-4 w-4" />
                  <div className="space-y-1">
                    <p>{errorMessage}</p>
                    {errorHint ? <p className="text-xs text-destructive/80">{errorHint}</p> : null}
                  </div>
                </div>
              </div>
            )}

            <div className="flex gap-3 pt-4">
              <Button
                onClick={testConnection}
                disabled={
                  !serverConfig.url ||
                  !serverConfig.username ||
                  !serverConfig.password ||
                  loading ||
                  testingConnection
                }
                variant="outline"
                className="flex-1"
              >
                {testingConnection ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : connectionStatus === 'success' ? (
                  <Check className="h-4 w-4 mr-2" />
                ) : null}
                {testingConnection
                  ? '测试中...'
                  : connectionStatus === 'success'
                    ? '连接成功'
                    : '测试连接'}
              </Button>
              <Button
                onClick={saveServerConfig}
                disabled={
                  !serverConfig.url ||
                  !serverConfig.username ||
                  !serverConfig.password ||
                  loading ||
                  connectionStatus !== 'success'
                }
                className="flex-1"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                开始使用
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
