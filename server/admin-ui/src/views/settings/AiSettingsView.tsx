import { Eye, EyeSlash, WarningCircle } from "@phosphor-icons/react"
import { useCallback, useState, type ReactNode } from "react"
import { useTranslation } from "react-i18next"
import {
  adminApi,
  api,
  type AiConfigItem,
  type AutomationSettings,
  type MemoryStats,
} from "../../api"
import { Button } from "../../components/ui/button"
import { ModelCombobox } from "../../components/ui/combobox"
import { ErrorState } from "../../components/ui/error-state"
import { Field } from "../../components/ui/field"
import { Input } from "../../components/ui/input"
import { PageHeader } from "../../components/ui/page-header"
import { ProgressBar } from "../../components/ui/progress"
import { Skeleton } from "../../components/ui/skeleton"
import { AppSwitch } from "../../components/ui/switch"
import { useAuthStore } from "../../stores/authStore"
import { useAsyncData } from "../../hooks/useAsyncData"
import { useToast } from "../../hooks/useToast"

interface ChatForm {
  baseUrl: string
  apiKey: string
  model: string
  maxTokens?: number
  supportsVision: boolean
  supportsThinking: boolean
}

interface EmbeddingForm {
  baseUrl: string
  apiKey: string
  model: string
  embeddingDim?: number
}

function chatFromItem(item?: AiConfigItem): ChatForm {
  return {
    baseUrl: item?.baseUrl ?? "",
    apiKey: item?.apiKey ?? "",
    model: item?.model ?? "",
    maxTokens: item?.maxTokens ?? undefined,
    supportsVision: item?.supportsVision ?? false,
    supportsThinking: item?.supportsThinking ?? false,
  }
}

function embeddingFromItem(item?: AiConfigItem): EmbeddingForm {
  return {
    baseUrl: item?.baseUrl ?? "",
    apiKey: item?.apiKey ?? "",
    model: item?.model ?? "",
    embeddingDim: item?.embeddingDim ?? undefined,
  }
}

async function fetchModelInfo(
  baseUrl: string,
  apiKey: string | undefined,
  model: string
) {
  const url = `${baseUrl.replace(/\/+$/, "")}/models`
  const res = await fetch(url, {
    headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
  })
  if (!res.ok) return null
  const body = (await res.json()) as {
    data?: Array<{
      id?: string
      input_modalities?: string[]
      features?: string[]
    }>
  }
  return body.data?.find((m) => m.id === model) ?? null
}

function KeyInput({
  value,
  onChange,
  show,
  onToggleShow,
  placeholder,
}: {
  value: string
  onChange: (v: string) => void
  show: boolean
  onToggleShow: () => void
  placeholder: string
}) {
  return (
    <div className="flex items-center gap-1.5">
      <Input
        type={show ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete="off"
        className="flex-1"
      />
      <button
        type="button"
        onClick={onToggleShow}
        className="flex size-10 shrink-0 items-center justify-center rounded-md text-ink-tertiary transition-colors hover:bg-subtle hover:text-ink md:size-9"
        aria-label="Toggle key visibility"
      >
        {show ? <EyeSlash size={15} /> : <Eye size={15} />}
      </button>
    </div>
  )
}

function ChatSection({
  config,
  currentUserId,
}: {
  config?: AiConfigItem
  currentUserId?: string
}) {
  const { t } = useTranslation()
  const toast = useToast()
  const [chat, setChat] = useState<ChatForm>(() => chatFromItem(config))
  const [showKey, setShowKey] = useState(false)
  const [saving, setSaving] = useState(false)

  async function selectModel(model: string) {
    setChat((f) => ({ ...f, model }))
    if (!model || !chat.baseUrl || !chat.apiKey) return
    try {
      const info = await fetchModelInfo(chat.baseUrl, chat.apiKey, model)
      if (!info) return
      setChat((f) => ({
        ...f,
        supportsVision:
          info.input_modalities?.includes("image") ||
          info.input_modalities?.includes("video") ||
          f.supportsVision,
        supportsThinking:
          info.features?.includes("reasoning") || f.supportsThinking,
      }))
    } catch {
      void 0
    }
  }

  async function save() {
    if (!currentUserId) return
    setSaving(true)
    try {
      await adminApi(`/users/${currentUserId}/ai-config`, {
        method: "PUT",
        body: {
          provider: "openai",
          baseUrl: chat.baseUrl,
          apiKey: chat.apiKey,
          model: chat.model,
          maxTokens: chat.maxTokens,
          supportsVision: chat.supportsVision,
          supportsThinking: chat.supportsThinking,
        },
      })
      toast.success(t("aiSettings.saved"))
    } catch {
      toast.error(t("aiSettings.saveFailed"))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <Field label={t("aiSettings.baseUrl")}>
        <Input
          value={chat.baseUrl}
          onChange={(e) => setChat((f) => ({ ...f, baseUrl: e.target.value }))}
          placeholder={t("aiSettings.apiUrlPlaceholder")}
        />
      </Field>
      <Field label={t("aiSettings.apiKey")}>
        <KeyInput
          value={chat.apiKey}
          onChange={(v) => setChat((f) => ({ ...f, apiKey: v }))}
          show={showKey}
          onToggleShow={() => setShowKey((v) => !v)}
          placeholder={t("aiSettings.apiKeyPlaceholder")}
        />
      </Field>
      <Field label={t("aiSettings.model")}>
        <ModelCombobox
          value={chat.model}
          onChange={(m) => void selectModel(m)}
          baseUrl={chat.baseUrl}
          apiKey={chat.apiKey}
          placeholder={t("aiSettings.modelPlaceholder")}
        />
      </Field>
      <Field
        label={t("aiSettings.maxTokens")}
        hint={t("aiSettings.maxTokensDesc")}
      >
        <Input
          type="number"
          min={1}
          max={128000}
          value={chat.maxTokens ?? ""}
          onChange={(e) =>
            setChat((f) => ({
              ...f,
              maxTokens: e.target.value ? Number(e.target.value) : undefined,
            }))
          }
        />
      </Field>
      <div className="flex flex-col gap-3">
        <span className="text-[13px] font-medium text-ink">
          {t("aiSettings.capabilities")}
        </span>
        <span className="-mt-2 text-xs text-ink-tertiary">
          {t("aiSettings.capabilitiesDesc")}
        </span>
        <label className="flex cursor-pointer items-center gap-2.5">
          <AppSwitch
            checked={chat.supportsVision}
            onCheckedChange={(v) =>
              setChat((f) => ({ ...f, supportsVision: v }))
            }
          />
          <span className="text-[13px] text-ink">{t("aiSettings.vision")}</span>
        </label>
        <label className="flex cursor-pointer items-center gap-2.5">
          <AppSwitch
            checked={chat.supportsThinking}
            onCheckedChange={(v) =>
              setChat((f) => ({ ...f, supportsThinking: v }))
            }
          />
          <span className="text-[13px] text-ink">
            {t("aiSettings.thinking")}
          </span>
        </label>
      </div>
      <Button disabled={saving} onClick={() => void save()}>
        {saving ? t("common.saving") : t("aiSettings.save")}
      </Button>
    </div>
  )
}

function EmbeddingSection({ config }: { config?: AiConfigItem }) {
  const { t } = useTranslation()
  const toast = useToast()
  const [embedding, setEmbedding] = useState<EmbeddingForm>(() =>
    embeddingFromItem(config)
  )
  const [showKey, setShowKey] = useState(false)
  const [saving, setSaving] = useState(false)

  async function save() {
    setSaving(true)
    try {
      await adminApi("/ai-config/embedding", {
        method: "PUT",
        body: {
          provider: "openai",
          baseUrl: embedding.baseUrl,
          apiKey: embedding.apiKey,
          model: embedding.model,
          embeddingDim: embedding.embeddingDim,
        },
      })
      toast.success(t("aiSettings.saved"))
    } catch {
      toast.error(t("aiSettings.saveFailed"))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <Field label={t("aiSettings.baseUrl")}>
        <Input
          value={embedding.baseUrl}
          onChange={(e) =>
            setEmbedding((f) => ({ ...f, baseUrl: e.target.value }))
          }
          placeholder={t("aiSettings.apiUrlPlaceholder")}
        />
      </Field>
      <Field label={t("aiSettings.apiKey")}>
        <KeyInput
          value={embedding.apiKey}
          onChange={(v) => setEmbedding((f) => ({ ...f, apiKey: v }))}
          show={showKey}
          onToggleShow={() => setShowKey((v) => !v)}
          placeholder={t("aiSettings.apiKeyPlaceholder")}
        />
      </Field>
      <Field label={t("aiSettings.model")}>
        <ModelCombobox
          value={embedding.model}
          onChange={(model) => setEmbedding((f) => ({ ...f, model }))}
          baseUrl={embedding.baseUrl}
          apiKey={embedding.apiKey}
          placeholder={t("aiSettings.modelPlaceholder")}
        />
      </Field>
      <Field
        label={t("aiSettings.vectorDim")}
        hint={t("aiSettings.vectorDimDesc")}
      >
        <Input
          type="number"
          min={1}
          value={embedding.embeddingDim ?? ""}
          onChange={(e) =>
            setEmbedding((f) => ({
              ...f,
              embeddingDim: e.target.value ? Number(e.target.value) : undefined,
            }))
          }
        />
      </Field>
      <Button disabled={saving} onClick={() => void save()}>
        {saving ? t("common.saving") : t("aiSettings.save")}
      </Button>
    </div>
  )
}

function AutomationSection({ initial }: { initial: AutomationSettings }) {
  const { t } = useTranslation()
  const toast = useToast()
  const [settings, setSettings] = useState<AutomationSettings>(() => initial)
  const [saving, setSaving] = useState(false)

  async function save() {
    setSaving(true)
    try {
      await adminApi("/settings", { method: "PUT", body: settings })
      toast.success(t("aiSettings.saved"))
    } catch {
      toast.error(t("aiSettings.saveFailed"))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-5">
      <SettingRow
        label={t("aiSettings.autoTag")}
        description={t("aiSettings.autoTagDesc")}
      >
        <AppSwitch
          checked={settings.autoTagEnabled}
          onCheckedChange={(v) =>
            setSettings((s) => ({ ...s, autoTagEnabled: v }))
          }
        />
      </SettingRow>
      <SettingRow
        label={t("aiSettings.autoSummary")}
        description={t("aiSettings.autoSummaryDesc")}
      >
        <AppSwitch
          checked={settings.autoSummaryEnabled}
          onCheckedChange={(v) =>
            setSettings((s) => ({ ...s, autoSummaryEnabled: v }))
          }
        />
      </SettingRow>
      <SettingRow
        label={t("aiSettings.autoDiary")}
        description={t("aiSettings.autoDiaryDesc")}
      >
        <AppSwitch
          checked={settings.autoDiaryEnabled}
          onCheckedChange={(v) =>
            setSettings((s) => ({ ...s, autoDiaryEnabled: v }))
          }
        />
      </SettingRow>
      <SettingRow
        label={t("aiSettings.minMemos")}
        description={t("aiSettings.minMemosDesc")}
      >
        <Input
          type="number"
          min={1}
          value={settings.autoDiaryMinMemos}
          onChange={(e) =>
            setSettings((s) => ({
              ...s,
              autoDiaryMinMemos: Number(e.target.value) || 1,
            }))
          }
          className="w-24 text-right"
        />
      </SettingRow>
      <SettingRow
        label={t("aiSettings.minChars")}
        description={t("aiSettings.minCharsDesc")}
      >
        <Input
          type="number"
          min={1}
          value={settings.autoDiaryMinChars}
          onChange={(e) =>
            setSettings((s) => ({
              ...s,
              autoDiaryMinChars: Number(e.target.value) || 1,
            }))
          }
          className="w-24 text-right"
        />
      </SettingRow>
      <SettingRow
        label={t("aiSettings.timezone")}
        description={t("aiSettings.timezonePlaceholder")}
      >
        <Input
          value={settings.appTimezone}
          onChange={(e) =>
            setSettings((s) => ({ ...s, appTimezone: e.target.value }))
          }
          className="w-44 text-right"
        />
      </SettingRow>
      <Button variant="secondary" disabled={saving} onClick={() => void save()}>
        {saving ? t("common.saving") : t("aiSettings.saveSettings")}
      </Button>
    </div>
  )
}

function MemorySection() {
  const { t } = useTranslation()
  const toast = useToast()
  const memory = useAsyncData<MemoryStats>(
    useCallback(() => api("/memory/stats") as Promise<MemoryStats>, [])
  )
  const [backfilling, setBackfilling] = useState(false)

  async function handleBackfill() {
    setBackfilling(true)
    try {
      await adminApi("/backfill-memory", { method: "POST" })
      toast.success(t("aiSettings.backfillStarted"))
      setTimeout(() => void memory.refetch(), 3000)
    } catch {
      toast.error(t("aiSettings.backfillFailed"))
    } finally {
      setBackfilling(false)
    }
  }

  const indexPercent =
    memory.data && memory.data.totalMemos > 0
      ? Math.round((memory.data.indexedMemos / memory.data.totalMemos) * 100)
      : 0
  const hasUnindexed =
    !!memory.data &&
    memory.data.totalMemos > 0 &&
    memory.data.indexedMemos < memory.data.totalMemos

  if (memory.loading && !memory.data) return <Skeleton className="h-16" />
  if (memory.error)
    return <ErrorState message={memory.error} onRetry={memory.refetch} />
  if (!memory.data) return null

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[13px] font-medium text-ink">
          {t("overview.vectorIndex")}
        </span>
        <div className="flex items-center gap-2.5">
          <span className="text-[13px] text-ink-tertiary tabular-nums">
            {t("aiSettings.memoryItems", {
              n: memory.data.indexedMemos,
              m: memory.data.totalMemos,
            })}
          </span>
          {hasUnindexed && (
            <Button
              size="sm"
              variant="secondary"
              disabled={backfilling}
              onClick={() => void handleBackfill()}
            >
              {backfilling
                ? t("aiSettings.processing")
                : t("aiSettings.backfill")}
            </Button>
          )}
        </div>
      </div>
      <ProgressBar value={indexPercent} />
      {memory.data.totalMemos === 0 && (
        <p className="text-xs text-ink-tertiary">
          {t("aiSettings.memoryEmpty")}
        </p>
      )}
      {hasUnindexed && (
        <p className="flex items-center gap-1.5 text-xs text-ink-tertiary">
          <WarningCircle size={13} />
          {t("aiSettings.memoryPending", {
            n: memory.data.totalMemos - memory.data.indexedMemos,
          })}
        </p>
      )}
    </div>
  )
}

export default function AiSettingsView() {
  const { t } = useTranslation()
  const currentUser = useAuthStore((s) => s.user)

  const config = useAsyncData<{ bot?: AiConfigItem; embedding?: AiConfigItem }>(
    useCallback(
      () =>
        adminApi("/ai-config") as Promise<{
          bot?: AiConfigItem
          embedding?: AiConfigItem
        }>,
      []
    )
  )
  const automation = useAsyncData<AutomationSettings>(
    useCallback(() => adminApi("/settings") as Promise<AutomationSettings>, [])
  )

  const chatSection =
    config.loading && !config.data ? (
      <Skeleton className="h-64" />
    ) : config.error ? (
      <ErrorState message={config.error} onRetry={config.refetch} />
    ) : (
      <ChatSection
        key="chat"
        config={config.data?.bot}
        currentUserId={currentUser?.id}
      />
    )

  const embeddingSection =
    config.loading && !config.data ? (
      <Skeleton className="h-48" />
    ) : config.error ? (
      <ErrorState message={config.error} onRetry={config.refetch} />
    ) : (
      <EmbeddingSection key="embedding" config={config.data?.embedding} />
    )

  const automationSection =
    automation.loading && !automation.data ? (
      <Skeleton className="h-64" />
    ) : automation.error ? (
      <ErrorState message={automation.error} onRetry={automation.refetch} />
    ) : (
      <AutomationSection
        key="automation"
        initial={
          automation.data ?? {
            autoTagEnabled: true,
            autoSummaryEnabled: false,
            autoDiaryEnabled: true,
            autoDiaryMinMemos: 2,
            autoDiaryMinChars: 150,
            appTimezone: "Asia/Shanghai",
          }
        }
      />
    )

  return (
    <div className="mx-auto max-w-2xl space-y-10">
      <PageHeader title={t("aiSettings.title")} />

      <section className="space-y-4">
        <div>
          <h2 className="text-[15px] font-semibold text-ink">
            {t("aiSettings.chatModel")}
          </h2>
          <p className="mt-0.5 text-xs text-ink-tertiary">
            {t("aiSettings.chatModelDesc")}
          </p>
        </div>
        {chatSection}
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-[15px] font-semibold text-ink">
            {t("aiSettings.embeddingModel")}
          </h2>
          <p className="mt-0.5 text-xs text-ink-tertiary">
            {t("aiSettings.embeddingModelDesc")}
          </p>
        </div>
        {embeddingSection}
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-[15px] font-semibold text-ink">
            {t("aiSettings.memoryTitle")}
          </h2>
          <p className="mt-0.5 text-xs text-ink-tertiary">
            {t("aiSettings.memoryDesc")}
          </p>
        </div>
        <MemorySection />
      </section>

      <section className="space-y-4">
        <h2 className="text-[15px] font-semibold text-ink">
          {t("aiSettings.automation")}
        </h2>
        {automationSection}
      </section>
    </div>
  )
}

function SettingRow({
  label,
  description,
  children,
}: {
  label: string
  description: string
  children: ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-6">
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-medium text-ink">{label}</p>
        <p className="mt-0.5 text-xs leading-relaxed text-ink-tertiary">
          {description}
        </p>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}
