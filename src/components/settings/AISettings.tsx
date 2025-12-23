import { useState, useEffect } from 'react'
import { SettingsSection } from './SettingsSection'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@radix-ui/react-label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { settingsCommands, loadAIConfig, saveAIConfig } from '@/utils/settings-helpers'
import type { AIConfig } from '@/types/settings'
import { Loader2, CheckCircle2, XCircle } from 'lucide-react'

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

  useEffect(() => {
    loadConfig()
  }, [])

  async function loadConfig() {
    setLoading(true)
    try {
      const loaded = await loadAIConfig()
      if (loaded) {
        setConfig(loaded)
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

  async function handleTest() {
    setTesting(true)
    setTestResult(null)
    try {
      const result = await settingsCommands.testAIConnection(
        config.provider,
        config.baseUrl,
        config.apiKey
      )
      setTestResult(result)
    } catch (error) {
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
    return <div>加载中...</div>
  }

  return (
    <div className="space-y-6">
      <SettingsSection title="AI配置" description="配置AI服务的API信息">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="provider">API 规范</Label>
            <Select value={config.provider} onValueChange={handleProviderChange}>
              <SelectTrigger id="provider">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="openai">OpenAI 规范</SelectItem>
                <SelectItem value="anthropic">Anthropic 规范</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              选择使用的 API 规范，而非具体的服务提供商
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="baseUrl">Base URL</Label>
            <Input
              id="baseUrl"
              value={config.baseUrl}
              onChange={e => setConfig({ ...config, baseUrl: e.target.value })}
              placeholder="https://api.openai.com"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="apiKey">API Key</Label>
            <Input
              id="apiKey"
              type="password"
              value={config.apiKey}
              onChange={e => setConfig({ ...config, apiKey: e.target.value })}
              placeholder="sk-..."
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="model">模型名称</Label>
            <Input
              id="model"
              value={config.model || ''}
              onChange={e => setConfig({ ...config, model: e.target.value })}
              placeholder="例如: gpt-4o, claude-3-5-sonnet-20241022"
            />
            <p className="text-xs text-muted-foreground">
              输入要使用的模型名称
            </p>
          </div>
        </div>
      </SettingsSection>

      <SettingsSection title="高级设置" description="可选的高级配置项">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="temperature">Temperature</Label>
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
            <Label htmlFor="maxTokens">Max Tokens</Label>
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
            <Label htmlFor="timeout">Timeout (秒)</Label>
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
      </SettingsSection>

      <div className="flex items-center gap-4 justify-center">
        <Button className='flex-1' onClick={handleSave} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
          保存
        </Button>
        <Button variant="outline" onClick={handleTest} disabled={testing || !config.apiKey}>
          {testing ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <>
              {testResult === true && <CheckCircle2 className="h-4 w-4 mr-2 text-green-500" />}
              {testResult === false && <XCircle className="h-4 w-4 mr-2 text-red-500" />}
            </>
          )}
          测试连接
        </Button>
        {saved && <span className="text-sm text-green-500">已保存</span>}
      </div>
    </div>
  )
}

