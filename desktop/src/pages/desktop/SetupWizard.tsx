import DarkMosaicIcon from '@/assets/mosaic-dark.svg'
import LightMosaicIcon from '@/assets/mosaic-light.svg'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useServerConfig } from '@/hooks/use-server-config'
import { useTheme } from '@/hooks/use-theme'
import { toast } from '@/hooks/use-toast'
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
  }

  const testConnection = async () => {
    setTestingConnection(true)
    setConnectionStatus('idle')
    setErrorMessage('')

    try {
      await configCommands.testServerConnection(serverConfig)
      setConnectionStatus('success')
      toast.success('服务器连接测试通过')
    } catch (error) {
      setConnectionStatus('error')
      const errMsg = error instanceof Error ? error.message : '连接失败，请检查配置'
      setErrorMessage(errMsg)
      toast.error(errMsg)
    } finally {
      setTestingConnection(false)
    }
  }

  const saveServerConfig = async () => {
    setLoading(true)
    try {
      await configCommands.setServerConfig(serverConfig)

      await configCommands.login(serverConfig.username, serverConfig.password)

      toast.success('服务器配置已保存')

      await checkConfig()

      window.location.reload()
      navigate('/')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '未知错误')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-linear-to-br from-background to-card p-4">
      <div className="w-full max-w-2xl space-y-8">
        {/* Header */}
        <div className="text-center flex flex-col items-center gap-4">
          <img
            src={theme === 'dark' ? DarkMosaicIcon : LightMosaicIcon}
            alt="Mosaic"
            className="size-32 h-auto"
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
                  <span>{errorMessage}</span>
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
