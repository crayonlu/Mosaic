import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { adminApi, type AdminAiConfigResponse, type ServerAiConfig } from '@mosaic/api'
import { Bot, Check, Database, Eye, EyeOff, Sparkles, X } from 'lucide-react'
import { useEffect, useState } from 'react'

type ConfigKey = 'bot' | 'embedding'

export function ServerAIConfigSettings() {
  const [loading, setLoading] = useState(true)
  const [configs, setConfigs] = useState<Record<ConfigKey, ServerAiConfig | null>>({
    bot: null,
    embedding: null,
  })
  const [showKeys, setShowKeys] = useState<Record<ConfigKey, boolean>>({
    bot: false,
    embedding: false,
  })

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const response: AdminAiConfigResponse = await adminApi.getAiConfig()
        setConfigs({ bot: response.bot, embedding: response.embedding })
      } catch (error) {
        console.error('Failed to load server AI config:', error)
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [])

  const maskKey = (key: string) => {
    if (!key) return '未配置'
    if (key.length <= 8) return '••••••••'
    return `${key.slice(0, 4)}••••${key.slice(-4)}`
  }

  const renderSection = (key: ConfigKey, title: string, description: string) => {
    const config = configs[key]
    const configured = config && config.model && config.apiKey

    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            {key === 'bot' ? <Bot className="h-5 w-5" /> : <Database className="h-5 w-5" />}
            <CardTitle>{title}</CardTitle>
            {configured ? (
              <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
                <Check className="h-3 w-3" /> 已配置
              </span>
            ) : (
              <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                <X className="h-3 w-3" /> 未配置
              </span>
            )}
          </div>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        {config && (
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <div>
                <span className="text-muted-foreground">API 规范</span>
                <p className="font-medium">{config.provider || '—'}</p>
              </div>
              <div>
                <span className="text-muted-foreground">模型</span>
                <p className="font-medium font-mono text-xs">{config.model || '—'}</p>
              </div>
              <div className="col-span-2">
                <span className="text-muted-foreground">Base URL</span>
                <p className="font-medium text-xs break-all">{config.baseUrl || '—'}</p>
              </div>
              <div className="col-span-2">
                <div className="flex items-center gap-1">
                  <span className="text-muted-foreground">API Key</span>
                  <button
                    type="button"
                    className="text-muted-foreground hover:text-foreground transition-colors"
                    onClick={() => setShowKeys(prev => ({ ...prev, [key]: !prev[key] }))}
                  >
                    {showKeys[key] ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                  </button>
                </div>
                <p className="font-medium font-mono text-xs">
                  {showKeys[key] ? config.apiKey || '—' : maskKey(config.apiKey)}
                </p>
              </div>
            </div>

            {(config.supportsVision || config.supportsThinking) && (
              <div className="flex items-center gap-2 pt-1">
                <Sparkles className="h-3.5 w-3.5 text-muted-foreground" />
                {config.supportsVision && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                    ✓ 图片输入
                  </span>
                )}
                {config.supportsThinking && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
                    ✓ 心路历程
                  </span>
                )}
              </div>
            )}
          </CardContent>
        )}
      </Card>
    )
  }

  if (loading) {
    return <div className="text-sm text-muted-foreground">加载中...</div>
  }

  return (
    <div className="space-y-6">
      {renderSection('bot', 'Bot 模型', 'Bot 自动回复与追问所使用的服务端模型')}
      {renderSection('embedding', 'Embedding 模型', '记忆向量化所使用的服务端模型')}
    </div>
  )
}
