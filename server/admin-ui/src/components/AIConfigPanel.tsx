import { Check, Eye, EyeOff, Loader, Sparkles } from "lucide-react"
import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { adminApi } from "../api"
import { useToast } from "../hooks/useToast"

type ConfigKey = "bot" | "embedding"
const providers = ["openai", "anthropic"] as const
const providerUrls: Record<string, string> = {
  openai: "https://api.openai.com",
  anthropic: "https://api.anthropic.com",
}

interface ConfigForm {
  provider: string
  baseUrl: string
  apiKey: string
  model: string
  embeddingDim?: number
  maxTokens?: number
  supportsVision: boolean
  supportsThinking: boolean
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

export default function AIConfigPanel() {
  const { t } = useTranslation()
  const toast = useToast()
  const [loading, setLoading] = useState(false)

  const [showKeys, setShowKeys] = useState({ bot: false, embedding: false })
  const [saving, setSaving] = useState({ bot: false, embedding: false })
  const [modelsLoading, setModelsLoading] = useState({
    bot: false,
    embedding: false,
  })
  const [modelErrors, setModelErrors] = useState({ bot: "", embedding: "" })
  const [modelLists, setModelLists] = useState({
    bot: [] as string[],
    embedding: [] as string[],
  })
  const [detectingCaps, setDetectingCaps] = useState({
    bot: false,
    embedding: false,
  })
  const [form, setForm] = useState({
    bot: {
      provider: "openai",
      baseUrl: "https://api.openai.com",
      apiKey: "",
      model: "",
      embeddingDim: undefined as number | undefined,
      maxTokens: undefined as number | undefined,
      supportsVision: false,
      supportsThinking: false,
    },
    embedding: {
      provider: "openai",
      baseUrl: "https://api.openai.com",
      apiKey: "",
      model: "",
      embeddingDim: undefined as number | undefined,
      maxTokens: undefined as number | undefined,
      supportsVision: false,
      supportsThinking: false,
    },
  })

  function setFormField(key: ConfigKey, field: Partial<ConfigForm>) {
    setForm((f) => ({ ...f, [key]: { ...f[key], ...field } }))
  }

  function setProvider(key: ConfigKey, provider: string) {
    setFormField(key, { provider, baseUrl: providerUrls[provider] || "" })
  }

  function filteredModels(key: ConfigKey) {
    const q = form[key].model.toLowerCase()
    if (!q) return modelLists[key]
    return modelLists[key].filter((m) => m.toLowerCase().includes(q))
  }

  async function loadConfig() {
    setLoading(true)
    try {
      const data = (await adminApi("/ai-config")) as ConfigResponse
      for (const k of ["bot", "embedding"] as ConfigKey[]) {
        const item = data[k]
        if (!item) continue
        setForm((f) => ({
          ...f,
          [k]: {
            ...f[k],
            provider: item.provider || "openai",
            baseUrl: item.baseUrl || "",
            apiKey: item.apiKey || "",
            model: item.model || "",
            embeddingDim: item.embeddingDim ?? undefined,
            maxTokens: item.maxTokens ?? undefined,
            supportsVision: item.supportsVision || false,
            supportsThinking: item.supportsThinking || false,
          },
        }))
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
      const url = `${f.baseUrl.replace(/\/+$/, "")}/models`
      const res = await fetch(url, {
        headers: f.apiKey ? { Authorization: `Bearer ${f.apiKey}` } : {},
      })
      if (!res.ok) throw new Error(`${res.status}`)
      const body = (await res.json()) as ModelListResponse
      setModelLists((l) => ({
        ...l,
        [key]: Array.isArray(body.data)
          ? body.data.map((m) => m.id).sort()
          : [],
      }))
      setModelErrors((e) => ({ ...e, [key]: "" }))
    } catch (error: unknown) {
      setModelLists((l) => ({ ...l, [key]: [] }))
      const message = error instanceof Error ? error.message : t("common.error")
      setModelErrors((e2) => ({
        ...e2,
        [key]: `${t("aiConfig.fetchFailed")}: ${message}`,
      }))
    } finally {
      setModelsLoading((l) => ({ ...l, [key]: false }))
    }
  }

  async function selectModel(key: ConfigKey, model: string) {
    setFormField(key, { model })
    // Auto-detect capabilities for bot models
    if (key !== "bot") return
    const f = form[key]
    if (!f.baseUrl || !f.apiKey || !model) return
    setDetectingCaps((d) => ({ ...d, [key]: true }))
    try {
      const url = `${f.baseUrl.replace(/\/+$/, "")}/models`
      const res = await fetch(url, {
        headers: f.apiKey ? { Authorization: `Bearer ${f.apiKey}` } : {},
      })
      if (!res.ok) return
      const body = await res.json()
      if (!Array.isArray(body.data)) return
      const info = body.data.find((m: { id: string }) => m.id === model)
      if (!info) return
      const inputModalities: string[] = info.input_modalities ?? []
      const features: string[] = info.features ?? []
      setFormField(key, {
        supportsVision:
          inputModalities.includes("image") ||
          inputModalities.includes("video"),
        supportsThinking: features.includes("reasoning"),
      })
    } catch {
      // Detection failed silently — user can still set manually
    } finally {
      setDetectingCaps((d) => ({ ...d, [key]: false }))
    }
  }

  async function save(key: ConfigKey) {
    setSaving((s) => ({ ...s, [key]: true }))
    try {
      const f = form[key]
      await adminApi(`/ai-config/${key}`, {
        method: "PUT",
        body: {
          provider: f.provider,
          baseUrl: f.baseUrl,
          apiKey: f.apiKey,
          model: f.model,
          embeddingDim: f.embeddingDim,
          maxTokens: f.maxTokens,
          supportsVision: f.supportsVision,
          supportsThinking: f.supportsThinking,
        },
      })
      toast.success(t("aiConfig.saved"))
    } catch {
      toast.error(t("aiConfig.saveFailed"))
    } finally {
      setSaving((s) => ({ ...s, [key]: false }))
    }
  }

  useEffect(() => {
    let active = true

    void (async () => {
      setLoading(true)
      try {
        const data = (await adminApi("/ai-config")) as ConfigResponse
        if (!active) return

        for (const k of ["bot", "embedding"] as ConfigKey[]) {
          const item = data[k]
          if (!item) continue
          setForm((f) => ({
            ...f,
            [k]: {
              ...f[k],
              provider: item.provider || "openai",
              baseUrl: item.baseUrl || "",
              apiKey: item.apiKey || "",
              model: item.model || "",
              embeddingDim: item.embeddingDim ?? undefined,
              maxTokens: item.maxTokens ?? undefined,
              supportsVision: item.supportsVision || false,
              supportsThinking: item.supportsThinking || false,
            },
          }))
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
      <div key={key} className="flex flex-col gap-3 p-3 sm:p-4">
        <h4 className="text-[13px] font-semibold text-foreground">{title}</h4>

        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-medium text-muted-foreground">
            {t("aiConfig.apiSpec")}
          </label>
          <div className="flex gap-0">
            {providers.map((p) => (
              <button
                key={p}
                className={`flex-1 cursor-pointer border px-3 py-1 font-sans text-[11px] font-medium transition-colors first:rounded-l last:rounded-r ${f.provider === p ? "border-primary bg-accent text-accent-foreground" : "border-border bg-card text-muted-foreground"}`}
                onClick={() => setProvider(key, p)}
              >
                {p === "openai"
                  ? t("aiConfig.openai")
                  : t("aiConfig.anthropic")}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-medium text-muted-foreground">
            {t("aiConfig.baseUrl")}
          </label>
          <input
            className="w-full rounded-md border border-border bg-card px-3 py-2 font-sans text-[13px] text-foreground transition-colors outline-none focus:border-ring"
            placeholder={t("aiConfig.apiUrlPlaceholder")}
            value={f.baseUrl}
            onChange={(e) => setFormField(key, { baseUrl: e.target.value })}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-medium text-muted-foreground">
            {t("aiConfig.apiKey")}
          </label>
          <div className="flex items-center gap-1">
            <input
              className="min-w-0 flex-1 rounded-md border border-border bg-card px-3 py-2 font-sans text-[13px] text-foreground transition-colors outline-none focus:border-ring"
              type={showKeys[key] ? "text" : "password"}
              placeholder={t("aiConfig.apiKeyPlaceholder")}
              value={f.apiKey}
              onChange={(e) => setFormField(key, { apiKey: e.target.value })}
            />
            <button
              className="flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-md border border-border bg-card text-muted-foreground transition-colors hover:bg-muted"
              onClick={() => setShowKeys((s) => ({ ...s, [key]: !s[key] }))}
            >
              {showKeys[key] ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-medium text-muted-foreground">
            {t("aiConfig.model")}
          </label>
          <div className="flex flex-col gap-1.5 sm:flex-row">
            <input
              className="min-w-0 flex-1 rounded-md border border-border bg-card px-3 py-2 font-sans text-[13px] text-foreground transition-colors outline-none focus:border-ring"
              placeholder={
                key === "bot"
                  ? f.provider === "openai"
                    ? "gpt-4o"
                    : "claude-sonnet-4-20250514"
                  : "text-embedding-3-small"
              }
              value={f.model}
              onChange={(e) => setFormField(key, { model: e.target.value })}
              onFocus={() => fetchModels(key)}
            />
            <button
              className="inline-flex w-full shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-md bg-secondary px-3 py-1.5 text-xs font-medium text-secondary-foreground transition-colors hover:bg-secondary/80 disabled:opacity-50 sm:w-auto"
              disabled={modelsLoading[key]}
              onClick={() => fetchModels(key)}
            >
              {modelsLoading[key] ? (
                <Loader size={13} className="spin" />
              ) : (
                <span>{t("aiConfig.fetch")}</span>
              )}
            </button>
          </div>
          {modelErrors[key] && (
            <p className="m-0 text-[11px] text-destructive">
              {modelErrors[key]}
            </p>
          )}
          {modelLists[key].length > 0 && (
            <div className="max-h-40 overflow-y-auto rounded-md border border-border">
              {filteredModels(key).map((m) => (
                <button
                  key={m}
                  className={`flex w-full cursor-pointer items-center justify-between border-none bg-transparent px-3 py-2 font-sans text-[12px] text-foreground transition-colors hover:bg-muted ${m === f.model ? "bg-accent" : ""}`}
                  onClick={() => selectModel(key, m)}
                >
                  <span className="overflow-hidden text-ellipsis whitespace-nowrap">
                    {m}
                  </span>
                  {m === f.model && <Check size={14} />}
                </button>
              ))}
            </div>
          )}
        </div>

        {key === "bot" && (
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-medium text-muted-foreground">
              {t("aiConfig.maxTokens")}
            </label>
            <input
              type="number"
              className="w-full rounded-md border border-border bg-card px-3 py-2 font-sans text-[13px] text-foreground transition-colors outline-none focus:border-ring"
              placeholder="512"
              min={1}
              max={128000}
              value={f.maxTokens ?? ""}
              onChange={(e) =>
                setFormField(key, {
                  maxTokens: e.target.value
                    ? Number(e.target.value)
                    : undefined,
                })
              }
            />
            <p className="m-0 text-[11px] text-muted-foreground">
              {t("aiConfig.maxTokensDesc")}
            </p>
          </div>
        )}

        {key === "embedding" && (
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-medium text-muted-foreground">
              {t("aiConfig.vectorDim")}
            </label>
            <input
              type="number"
              className="w-full rounded-md border border-border bg-card px-3 py-2 font-sans text-[13px] text-foreground transition-colors outline-none focus:border-ring"
              placeholder="1536"
              value={f.embeddingDim ?? ""}
              onChange={(e) =>
                setFormField(key, {
                  embeddingDim: e.target.value
                    ? Number(e.target.value)
                    : undefined,
                })
              }
            />
            <p className="m-0 text-[11px] text-muted-foreground">
              {t("aiConfig.vectorDimDesc")}
            </p>
          </div>
        )}

        {key === "bot" && (
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-1.5">
              <label className="text-[11px] font-medium text-muted-foreground">
                {t("aiConfig.capabilities")}
              </label>
              {detectingCaps[key] && (
                <Loader size={10} className="spin text-muted-foreground" />
              )}
            </div>
            <p className="m-0 text-[10px] text-muted-foreground">
              {t("aiConfig.capabilitiesDesc")}
            </p>
            <div className="flex gap-4">
              <label className="flex cursor-pointer items-center gap-1.5 text-[12px] text-foreground">
                <input
                  type="checkbox"
                  checked={f.supportsVision}
                  onChange={(e) =>
                    setFormField(key, { supportsVision: e.target.checked })
                  }
                />
                {t("aiConfig.vision")}
              </label>
              <label className="flex cursor-pointer items-center gap-1.5 text-[12px] text-foreground">
                <input
                  type="checkbox"
                  checked={f.supportsThinking}
                  onChange={(e) =>
                    setFormField(key, { supportsThinking: e.target.checked })
                  }
                />
                {t("aiConfig.thinking")}
              </label>
            </div>
          </div>
        )}

        <button
          className="inline-flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-[13px] font-semibold text-primary-foreground transition-colors hover:bg-primary/80 disabled:opacity-50"
          disabled={saving[key]}
          onClick={() => save(key)}
        >
          {saving[key] ? (
            <Loader size={14} className="spin" />
          ) : (
            <span>
              {key === "bot"
                ? t("aiConfig.saveBot")
                : t("aiConfig.saveEmbedding")}
            </span>
          )}
        </button>
      </div>
    )
  }

  return (
    <div className="border-b border-border">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h3 className="flex items-center gap-1.5 text-[13px] font-semibold text-foreground">
          <Sparkles size={16} />
          {t("aiConfig.title")}
        </h3>
        <button
          className="cursor-pointer border-none bg-transparent text-xs text-muted-foreground transition-colors hover:text-foreground"
          onClick={loadConfig}
        >
          {t("aiConfig.refresh")}
        </button>
      </div>
      <div className="px-3 py-3 sm:px-4">
        {loading ? (
          <div className="skeleton h-30" />
        ) : (
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {renderCard("bot", t("aiConfig.botModel"))}
            {renderCard("embedding", t("aiConfig.embeddingModel"))}
          </div>
        )}
      </div>
    </div>
  )
}
