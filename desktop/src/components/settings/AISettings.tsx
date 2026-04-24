import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { LoadingButton } from '@/components/ui/loading/loading-button'
import { LoadingSkeleton } from '@/components/ui/loading/loading-skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { AIConfig } from '@/types/settings'
import { loadAIConfig, saveAIConfig, settingsCommands } from '@/utils/settingsHelpers'
import { detectModelCapabilities, type ModelCapabilities } from '@mosaic/utils'
import { Label } from '@radix-ui/react-label'
import { Bot, CheckCircle2, Eye, Lightbulb, Loader2, XCircle } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'

const DEFAULT_BASE_URLS = {
  openai: 'https://api.openai.com',
  anthropic: 'https://api.anthropic.com',
}

export function AISettings() {
  const [config, setConfig] = useState<AIConfig>({
    provider: 'openai',
    baseUrl: DEFAULT_BASE_URLS.openai,
    apiKey: '',
  })
  const [loading, setLoading] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<boolean | null>(null)
  const [saved, setSaved] = useState(false)
  const [capabilities, setCapabilities] = useState<ModelCapabilities | null>(null)
  const [detecting, setDetecting] = useState(false)
  const detectTimer = useRef<ReturnType<typeof setTimeout>>(null)

  useEffect(() => {
    loadConfig()
  }, [])

  const detectCapabilities = useCallback(
    (model: string | undefined, baseUrl: string, apiKey: string) => {
      if (!model || !baseUrl || !apiKey) {
        setCapabilities(null)
        return
      }
      setDetecting(true)
      detectModelCapabilities(baseUrl, apiKey, model).then(result => {
        setCapabilities(result)
        setDetecting(false)
      })
    },
    []
  )

  async function loadConfig() {
    setLoading(true)
    try {
      const loaded = await loadAIConfig()
      if (loaded) {
        setConfig(loaded)
        detectCapabilities(loaded.model, loaded.baseUrl, loaded.apiKey)
      }
    } catch (error) {
      console.error('Failed to load AI config:', error)
    } finally {
      setLoading(false)
    }
  }

  async function handleSave() {
    setLoading(true)
    setSaved(false)
    try {
      await saveAIConfig(config)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (error) {
      console.error('Failed to save AI config:', error)
    } finally {
      setLoading(false)
    }
  }

  function handleModelChange(model: string) {
    setConfig({ ...config, model: model || undefined })
    if (detectTimer.current) clearTimeout(detectTimer.current)
    detectTimer.current = setTimeout(() => {
      detectCapabilities(model || undefined, config.baseUrl, config.apiKey)
    }, 500)
  }

  async function handleTest() {
    setTesting(true)
    setTestResult(null)
    try {
      await settingsCommands.testAIConnection(
        config.provider,
        config.baseUrl,
        config.apiKey,
        config.model,
        config.temperature,
        config.maxTokens,
        config.timeout
      )
      setTestResult(true)
    } catch (error) {
      console.error('Failed to test AI connection:', error)
      setTestResult(false)
    } finally {
      setTesting(false)
    }
  }

  function handleProviderChange(provider: 'openai' | 'anthropic') {
    setConfig({
      ...config,
      provider,
      baseUrl: DEFAULT_BASE_URLS[provider],
    })
  }

  if (loading && !config.apiKey) {
    return <LoadingSkeleton lines={3} />
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Bot className="h-5 w-5" />
          <CardTitle>AI 配置</CardTitle>
        </div>
        <CardDescription>配置AI助手以增强您的写作体验</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-sm font-medium" htmlFor="provider">
              API 规范
            </Label>
            <Select value={config.provider} onValueChange={handleProviderChange}>
              <SelectTrigger id="provider">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="openai">OpenAI</SelectItem>
                <SelectItem value="anthropic">Anthropic</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium" htmlFor="apiKey">
              API Key
            </Label>
            <Input
              id="apiKey"
              type="password"
              value={config.apiKey}
              onChange={e => setConfig({ ...config, apiKey: e.target.value })}
              placeholder="sk-..."
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-sm font-medium" htmlFor="baseUrl">
            Base URL
          </Label>
          <Input
            id="baseUrl"
            value={config.baseUrl}
            onChange={e => setConfig({ ...config, baseUrl: e.target.value })}
            placeholder="https://api.openai.com"
          />
        </div>

        <div className="space-y-2">
          <Label className="text-sm font-medium" htmlFor="model">
            模型名称
          </Label>
          <Input
            id="model"
            value={config.model || ''}
            onChange={e => handleModelChange(e.target.value)}
            placeholder="例如: gpt-4o, claude-3-5-sonnet-20241022"
          />
          <div className="min-h-5">
            {detecting && (
              <span className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" />
                检测中...
              </span>
            )}
            {!detecting &&
              capabilities &&
              (capabilities.supportsVision || capabilities.supportsThinking) && (
                <span className="inline-flex items-center gap-3 text-[13px] text-muted-foreground">
                  {capabilities.supportsVision && (
                    <span className="inline-flex items-center gap-1">
                      <Eye className="h-3.5 w-3.5" />
                      支持图片输入
                    </span>
                  )}
                  {capabilities.supportsThinking && (
                    <span className="inline-flex items-center gap-1">
                      <Lightbulb className="h-3.5 w-3.5" />
                      支持心路历程
                    </span>
                  )}
                </span>
              )}
            {!detecting &&
              capabilities &&
              !capabilities.supportsVision &&
              !capabilities.supportsThinking &&
              config.model && (
                <span className="text-[13px] text-muted-foreground">
                  无法识别模型能力，图片和心路历程功能可能不可用
                </span>
              )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t">
          <div className="space-y-2">
            <Label className="text-sm font-medium" htmlFor="temperature">
              Temperature
            </Label>
            <Input
              id="temperature"
              type="number"
              min="0"
              max="2"
              step="0.1"
              value={config.temperature ?? ''}
              onChange={e =>
                setConfig({
                  ...config,
                  temperature: e.target.value ? parseFloat(e.target.value) : undefined,
                })
              }
              placeholder="0.7"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium" htmlFor="maxTokens">
              Max Tokens
            </Label>
            <Input
              id="maxTokens"
              type="number"
              min="1"
              value={config.maxTokens ?? ''}
              onChange={e =>
                setConfig({
                  ...config,
                  maxTokens: e.target.value ? parseInt(e.target.value, 10) : undefined,
                })
              }
              placeholder="2000"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium" htmlFor="timeout">
              Timeout (秒)
            </Label>
            <Input
              id="timeout"
              type="number"
              min="1"
              value={config.timeout ?? ''}
              onChange={e =>
                setConfig({
                  ...config,
                  timeout: e.target.value ? parseInt(e.target.value, 10) : undefined,
                })
              }
              placeholder="30"
            />
          </div>
        </div>
      </CardContent>
      <CardFooter className="flex gap-3">
        <LoadingButton
          onClick={handleSave}
          loading={loading}
          loadingText="保存中..."
          className="flex-1"
        >
          保存
        </LoadingButton>
        <LoadingButton
          variant="outline"
          onClick={handleTest}
          loading={testing}
          loadingText="测试中..."
          disabled={!config.apiKey}
        >
          {testResult === true && <CheckCircle2 className="h-4 w-4 mr-2 text-green-500" />}
          {testResult === false && <XCircle className="h-4 w-4 mr-2 text-red-500" />}
          测试连接
        </LoadingButton>
        {saved && <span className="text-xs text-green-500 ml-2">已保存</span>}
      </CardFooter>
    </Card>
  )
}
