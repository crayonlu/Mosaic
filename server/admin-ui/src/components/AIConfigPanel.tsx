import { Check, Eye, EyeOff, Loader, Sparkles } from 'lucide-react'
import { useEffect, useState } from 'react'
import { adminApi } from '../api'
import { useToast } from '../hooks/useToast'

type ConfigKey = 'bot' | 'embedding'
const providers = ['openai', 'anthropic'] as const
const providerUrls: Record<string, string> = {
  openai: 'https://api.openai.com',
  anthropic: 'https://api.anthropic.com',
}

interface ConfigForm {
  provider: string
  baseUrl: string
  apiKey: string
  model: string
  embeddingDim?: number
  maxTokens?: number
}

interface ConfigResponseItem {
  provider?: string
  baseUrl?: string
  apiKey?: string
  model?: string
  embeddingDim?: number | null
  maxTokens?: number | null
  supportsVision?: boolean
  supportsThinking?: boolean
}

interface ConfigResponse {
  bot?: ConfigResponseItem
  embedding?: ConfigResponseItem
}

interface ModelListResponse {
  data?: Array<{ id: string }>
}

interface SaveResponse {
  supportsVision?: boolean
  supportsThinking?: boolean
}

export default function AIConfigPanel() {
  const toast = useToast()
  const [loading, setLoading] = useState(false)

  const [showKeys, setShowKeys] = useState({ bot: false, embedding: false })
  const [saving, setSaving] = useState({ bot: false, embedding: false })
  const [modelsLoading, setModelsLoading] = useState({ bot: false, embedding: false })
  const [modelErrors, setModelErrors] = useState({ bot: '', embedding: '' })
  const [modelLists, setModelLists] = useState({ bot: [] as string[], embedding: [] as string[] })
  const [saved, setSaved] = useState({
    bot: { supportsVision: false, supportsThinking: false },
    embedding: { supportsVision: false, supportsThinking: false },
  })

  const [form, setForm] = useState({
    bot: { provider: 'openai', baseUrl: 'https://api.openai.com', apiKey: '', model: '', embeddingDim: undefined as number | undefined, maxTokens: undefined as number | undefined },
    embedding: { provider: 'openai', baseUrl: 'https://api.openai.com', apiKey: '', model: '', embeddingDim: undefined as number | undefined, maxTokens: undefined as number | undefined },
  })

  function setFormField(key: ConfigKey, field: Partial<ConfigForm>) {
    setForm((f) => ({ ...f, [key]: { ...f[key], ...field } }))
  }

  function setProvider(key: ConfigKey, provider: string) {
    setFormField(key, { provider, baseUrl: providerUrls[provider] || '' })
  }

  function filteredModels(key: ConfigKey) {
    const q = form[key].model.toLowerCase()
    if (!q) return modelLists[key]
    return modelLists[key].filter((m) => m.toLowerCase().includes(q))
  }

  async function loadConfig() {
    setLoading(true)
    try {
      const data = (await adminApi('/ai-config')) as ConfigResponse
      for (const k of ['bot', 'embedding'] as ConfigKey[]) {
        if (!data[k]) continue
        setForm((f) => ({
          ...f,
          [k]: {
            ...f[k],
            provider: data[k].provider || 'openai',
            baseUrl: data[k].baseUrl || '',
            apiKey: data[k].apiKey || '',
            model: data[k].model || '',
            embeddingDim: data[k].embeddingDim ?? undefined,
            maxTokens: data[k].maxTokens ?? undefined,
          },
        }))
        setSaved((s) => ({ ...s, [k]: { supportsVision: data[k].supportsVision || false, supportsThinking: data[k].supportsThinking || false } }))
      }
    } catch {
      /* ignore */
    } finally {
      setLoading(false)
    }
  }

  async function fetchModels(key: ConfigKey) {
    const f = form[key]
    if (!f.baseUrl.trim()) return
    setModelsLoading((l) => ({ ...l, [key]: true }))
    try {
      const url = `${f.baseUrl.replace(/\/+$/, '')}/models`
      const res = await fetch(url, {
        headers: f.apiKey ? { Authorization: `Bearer ${f.apiKey}` } : {},
      })
      if (!res.ok) throw new Error(`${res.status}`)
      const body = (await res.json()) as ModelListResponse
      setModelLists((l) => ({
        ...l,
        [key]: Array.isArray(body.data) ? body.data.map((m) => m.id).sort() : [],
      }))
      setModelErrors((e) => ({ ...e, [key]: '' }))
    } catch (error: unknown) {
      setModelLists((l) => ({ ...l, [key]: [] }))
      const message = error instanceof Error ? error.message : '未知错误'
      setModelErrors((e2) => ({ ...e2, [key]: `获取失败: ${message}` }))
    } finally {
      setModelsLoading((l) => ({ ...l, [key]: false }))
    }
  }

  async function save(key: ConfigKey) {
    setSaving((s) => ({ ...s, [key]: true }))
    try {
      const f = form[key]
      const result = (await adminApi(`/ai-config/${key}`, {
        method: 'PUT',
        body: { provider: f.provider, baseUrl: f.baseUrl, apiKey: f.apiKey, model: f.model, embeddingDim: f.embeddingDim, maxTokens: f.maxTokens },
      })) as SaveResponse
      setSaved((s) => ({
        ...s,
        [key]: { supportsVision: result.supportsVision || false, supportsThinking: result.supportsThinking || false },
      }))
      toast.success(`${key === 'bot' ? 'Bot' : 'Embedding'} 配置已保存`)
    } catch {
      toast.error('保存失败')
    } finally {
      setSaving((s) => ({ ...s, [key]: false }))
    }
  }

  useEffect(() => {
    let active = true

    void (async () => {
      setLoading(true)
      try {
        const data = (await adminApi('/ai-config')) as ConfigResponse
        if (!active) return

        for (const k of ['bot', 'embedding'] as ConfigKey[]) {
          if (!data[k]) continue
          setForm((f) => ({
            ...f,
            [k]: {
              ...f[k],
              provider: data[k].provider || 'openai',
              baseUrl: data[k].baseUrl || '',
              apiKey: data[k].apiKey || '',
              model: data[k].model || '',
              embeddingDim: data[k].embeddingDim ?? undefined,
            },
          }))
          setSaved((s) => ({ ...s, [k]: { supportsVision: data[k].supportsVision || false, supportsThinking: data[k].supportsThinking || false } }))
        }
      } catch {
        /* ignore */
      } finally {
        if (active) setLoading(false)
      }
    })()

    return () => {
      active = false
    }
  }, [])

  function renderCard(key: ConfigKey, title: string) {
    const f = form[key]
    return (
      <div key={key} className="flex flex-col gap-3 rounded-md border border-border bg-muted p-3 sm:p-4">
        <h4 className="text-[13px] font-semibold text-foreground">{title}</h4>

        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-medium text-muted-foreground">API 规范</label>
          <div className="flex gap-0">
            {providers.map((p) => (
              <button
                key={p}
                className={`flex-1 border px-3 py-1 text-[11px] font-medium font-sans transition-colors cursor-pointer first:rounded-l last:rounded-r ${f.provider === p ? 'bg-accent text-accent-foreground border-primary' : 'bg-card text-muted-foreground border-border'}`}
                onClick={() => setProvider(key, p)}
              >
                {p === 'openai' ? 'OpenAI' : 'Anthropic'}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-medium text-muted-foreground">Base URL</label>
          <input
            className="w-full rounded-md border border-border bg-card px-3 py-2 text-[13px] text-foreground font-sans outline-none transition-colors focus:border-ring"
            placeholder="https://api.openai.com"
            value={f.baseUrl}
            onChange={(e) => setFormField(key, { baseUrl: e.target.value })}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-medium text-muted-foreground">API Key</label>
          <div className="flex gap-1 items-center">
            <input
              className="min-w-0 flex-1 rounded-md border border-border bg-card px-3 py-2 text-[13px] text-foreground font-sans outline-none transition-colors focus:border-ring"
              type={showKeys[key] ? 'text' : 'password'}
              placeholder="sk-..."
              value={f.apiKey}
              onChange={(e) => setFormField(key, { apiKey: e.target.value })}
            />
            <button
              className="flex size-9 shrink-0 items-center justify-center rounded-md border border-border bg-card text-muted-foreground transition-colors cursor-pointer hover:bg-muted"
              onClick={() => setShowKeys((s) => ({ ...s, [key]: !s[key] }))}
            >
              {showKeys[key] ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-medium text-muted-foreground">模型</label>
          <div className="flex flex-col gap-1.5 sm:flex-row">
            <input
              className="min-w-0 flex-1 rounded-md border border-border bg-card px-3 py-2 text-[13px] text-foreground font-sans outline-none transition-colors focus:border-ring"
              placeholder={key === 'bot' ? (f.provider === 'openai' ? 'gpt-4o' : 'claude-sonnet-4-20250514') : 'text-embedding-3-small'}
              value={f.model}
              onChange={(e) => setFormField(key, { model: e.target.value })}
              onFocus={() => fetchModels(key)}
            />
            <button
              className="inline-flex w-full shrink-0 items-center justify-center gap-1.5 rounded-md bg-secondary px-3 py-1.5 text-xs font-medium text-secondary-foreground transition-colors cursor-pointer hover:bg-secondary/80 disabled:opacity-50 sm:w-auto"
              disabled={modelsLoading[key]}
              onClick={() => fetchModels(key)}
            >
              {modelsLoading[key] ? <Loader size={13} className="spin" /> : <span>获取</span>}
            </button>
          </div>
          {modelErrors[key] && <p className="m-0 text-[11px] text-destructive">{modelErrors[key]}</p>}
          {modelLists[key].length > 0 && (
            <div className="max-h-[160px] overflow-y-auto rounded-md border border-border">
              {filteredModels(key).map((m) => (
                <button
                  key={m}
                  className={`flex w-full items-center justify-between border-none bg-transparent px-3 py-2 text-[12px] text-foreground font-sans transition-colors cursor-pointer hover:bg-muted ${m === f.model ? 'bg-accent' : ''}`}
                  onClick={() => setFormField(key, { model: m })}
                >
                  <span className="overflow-hidden text-ellipsis whitespace-nowrap">{m}</span>
                  {m === f.model && <Check size={14} />}
                </button>
              ))}
            </div>
          )}
        </div>

        {key === 'bot' && (
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-medium text-muted-foreground">Max Tokens</label>
            <input
              type="number"
              className="w-full rounded-md border border-border bg-card px-3 py-2 text-[13px] text-foreground font-sans outline-none transition-colors focus:border-ring"
              placeholder="512"
              min={1}
              max={128000}
              value={f.maxTokens ?? ''}
              onChange={(e) => setFormField(key, { maxTokens: e.target.value ? Number(e.target.value) : undefined })}
            />
            <p className="m-0 text-[11px] text-muted-foreground">每次回复的最大 token 数。留空则使用默认值 512。</p>
          </div>
        )}

        {key === 'embedding' && (
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-medium text-muted-foreground">向量维度</label>
            <input
              type="number"
              className="w-full rounded-md border border-border bg-card px-3 py-2 text-[13px] text-foreground font-sans outline-none transition-colors focus:border-ring"
              placeholder="1536"
              value={f.embeddingDim ?? ''}
              onChange={(e) => setFormField(key, { embeddingDim: e.target.value ? Number(e.target.value) : undefined })}
            />
            <p className="m-0 text-[11px] text-muted-foreground">首次使用会自动检测，也可手动指定。换模型时需更新并重新生成向量。</p>
          </div>
        )}

        {(saved[key].supportsVision || saved[key].supportsThinking) && (
          <div className="flex gap-2 text-[11px] text-muted-foreground">
            {saved[key].supportsVision && <span>✓ 图片输入</span>}
            {saved[key].supportsThinking && <span>✓ 心路历程</span>}
          </div>
        )}

        <button
          className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-[13px] font-semibold text-primary-foreground transition-colors cursor-pointer hover:bg-primary/80 disabled:opacity-50"
          disabled={saving[key]}
          onClick={() => save(key)}
        >
          {saving[key] ? <Loader size={14} className="spin" /> : <span>保存{key === 'bot' ? ' Bot' : ' Embedding'} 配置</span>}
        </button>
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h3 className="flex items-center gap-1.5 text-[13px] font-semibold text-foreground">
          <Sparkles size={16} />
          AI 模型配置
        </h3>
        <button className="border-none bg-transparent text-xs text-muted-foreground cursor-pointer hover:text-foreground transition-colors" onClick={loadConfig}>刷新</button>
      </div>
      <div className="px-3 py-3 sm:px-4">
        {loading ? <div className="skeleton h-[120px]" /> : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {renderCard('bot', 'Bot 模型')}
            {renderCard('embedding', 'Embedding 模型')}
          </div>
        )}
      </div>
    </div>
  )
}
