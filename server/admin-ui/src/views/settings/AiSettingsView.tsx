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
import { AppTabs, TabPanel } from "../../components/ui/tabs"
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

function KeyField({
  label,
  value,
  onChange,
  show,
  onToggleShow,
  placeholder,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  show: boolean
  onToggleShow: () => void
  placeholder: string
}) {
  return (
    <Field label={label}>
      <div className="flex items-center gap-1 rounded-md bg-subtle px-3 transition-colors focus-within:bg-surface focus-within:ring-1 focus-within:ring-primary/50 focus-within:ring-inset">
        <input
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete="off"
          className="h-[40px] w-full min-w-0 bg-transparent text-base text-ink outline-none placeholder:text-ink-tertiary md:h-9 md:text-sm"
        />
        <button
          type="button"
          onClick={onToggleShow}
          className="flex size-8 shrink-0 items-center justify-center rounded-md text-ink-tertiary transition-colors hover:bg-ink/5 hover:text-ink"
          aria-label="Toggle key visibility"
        >
          {show ? <EyeSlash size={15} /> : <Eye size={15} />}
        </button>
      </div>
    </Field>
  )
}

function ChatFormFields({
  form,
  onChange,
}: {
  form: ChatForm
  onChange: (f: ChatForm) => void
}) {
  const { t } = useTranslation()
  const [showKey, setShowKey] = useState(false)

  async function selectModel(model: string) {
    onChange({ ...form, model })
    if (!model || !form.baseUrl || !form.apiKey) return
    try {
      const info = await fetchModelInfo(form.baseUrl, form.apiKey, model)
      if (!info) return
      onChange({
        ...form,
        model,
        supportsVision:
          info.input_modalities?.includes("image") ||
          info.input_modalities?.includes("video") ||
          form.supportsVision,
        supportsThinking:
          info.features?.includes("reasoning") || form.supportsThinking,
      })
    } catch {
      void 0
    }
  }

  return (
    <div className="space-y-4">
      <Field label={t("aiSettings.baseUrl")}>
        <Input
          value={form.baseUrl}
          onChange={(e) => onChange({ ...form, baseUrl: e.target.value })}
          placeholder={t("aiSettings.apiUrlPlaceholder")}
        />
      </Field>
      <KeyField
        label={t("aiSettings.apiKey")}
        value={form.apiKey}
        onChange={(v) => onChange({ ...form, apiKey: v })}
        show={showKey}
        onToggleShow={() => setShowKey((v) => !v)}
        placeholder={t("aiSettings.apiKeyPlaceholder")}
      />
      <Field label={t("aiSettings.model")}>
        <ModelCombobox
          value={form.model}
          onChange={(m) => void selectModel(m)}
          baseUrl={form.baseUrl}
          apiKey={form.apiKey}
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
          value={form.maxTokens ?? ""}
          onChange={(e) =>
            onChange({
              ...form,
              maxTokens: e.target.value ? Number(e.target.value) : undefined,
            })
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
            checked={form.supportsVision}
            onCheckedChange={(v) => onChange({ ...form, supportsVision: v })}
          />
          <span className="text-[13px] text-ink">{t("aiSettings.vision")}</span>
        </label>
        <label className="flex cursor-pointer items-center gap-2.5">
          <AppSwitch
            checked={form.supportsThinking}
            onCheckedChange={(v) => onChange({ ...form, supportsThinking: v })}
          />
          <span className="text-[13px] text-ink">
            {t("aiSettings.thinking")}
          </span>
        </label>
      </div>
    </div>
  )
}

function EmbeddingFormFields({
  form,
  onChange,
}: {
  form: EmbeddingForm
  onChange: (f: EmbeddingForm) => void
}) {
  const { t } = useTranslation()
  const [showKey, setShowKey] = useState(false)

  return (
    <div className="space-y-4">
      <Field label={t("aiSettings.baseUrl")}>
        <Input
          value={form.baseUrl}
          onChange={(e) => onChange({ ...form, baseUrl: e.target.value })}
          placeholder={t("aiSettings.apiUrlPlaceholder")}
        />
      </Field>
      <KeyField
        label={t("aiSettings.apiKey")}
        value={form.apiKey}
        onChange={(v) => onChange({ ...form, apiKey: v })}
        show={showKey}
        onToggleShow={() => setShowKey((v) => !v)}
        placeholder={t("aiSettings.apiKeyPlaceholder")}
      />
      <Field label={t("aiSettings.model")}>
        <ModelCombobox
          value={form.model}
          onChange={(model) => onChange({ ...form, model })}
          baseUrl={form.baseUrl}
          apiKey={form.apiKey}
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
          value={form.embeddingDim ?? ""}
          onChange={(e) =>
            onChange({
              ...form,
              embeddingDim: e.target.value ? Number(e.target.value) : undefined,
            })
          }
        />
      </Field>
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
  const toast = useToast()
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

  const [tab, setTab] = useState<"chat" | "embedding">("chat")
  const [chat, setChat] = useState<ChatForm>(() => chatFromItem(undefined))
  const [embedding, setEmbedding] = useState<EmbeddingForm>(() =>
    embeddingFromItem(undefined)
  )
  const [settings, setSettings] = useState<AutomationSettings>({
    autoTagEnabled: true,
    autoSummaryEnabled: false,
    autoDiaryEnabled: true,
    autoDiaryMinMemos: 2,
    autoDiaryMinChars: 150,
    appTimezone: "Asia/Shanghai",
  })
  const [hydrated, setHydrated] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(false)

  if (config.data && !hydrated) {
    setChat(chatFromItem(config.data.bot))
    setEmbedding(embeddingFromItem(config.data.embedding))
    setHydrated(true)
  }
  if (automation.data && !hydrated) {
    setSettings(automation.data)
    setHydrated(true)
  }

  const canSave = !!config.data && !!automation.data

  async function saveAll() {
    if (!currentUser) return
    setSaving(true)
    setSaveError(false)
    const results = await Promise.allSettled([
      adminApi(`/users/${currentUser.id}/ai-config`, {
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
      }),
      adminApi("/ai-config/embedding", {
        method: "PUT",
        body: {
          provider: "openai",
          baseUrl: embedding.baseUrl,
          apiKey: embedding.apiKey,
          model: embedding.model,
          embeddingDim: embedding.embeddingDim,
        },
      }),
      adminApi("/settings", { method: "PUT", body: settings }),
    ])
    setSaving(false)
    const failed = results.filter((r) => r.status === "rejected").length
    if (failed === 0) {
      toast.success(t("aiSettings.saved"))
    } else {
      setSaveError(true)
      toast.error(`${failed} ${t("aiSettings.saveFailed")}`)
    }
  }

  const automationSection =
    automation.loading && !automation.data ? (
      <Skeleton className="h-64" />
    ) : automation.error ? (
      <ErrorState message={automation.error} onRetry={automation.refetch} />
    ) : (
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
      </div>
    )

  return (
    <div className="mx-auto max-w-2xl space-y-10">
      <PageHeader title={t("aiSettings.title")} />

      <section className="space-y-4">
        <div>
          <h2 className="text-[15px] font-semibold text-ink">
            {t("aiSettings.modelConfig")}
          </h2>
          <p className="mt-0.5 text-xs text-ink-tertiary">
            {t("aiSettings.modelConfigDesc")}
          </p>
        </div>
        {config.loading && !config.data ? (
          <Skeleton className="h-72" />
        ) : config.error ? (
          <ErrorState message={config.error} onRetry={config.refetch} />
        ) : (
          <AppTabs
            value={tab}
            onValueChange={(v) => setTab(v as "chat" | "embedding")}
            tabs={[
              { value: "chat", label: t("aiSettings.chatModel") },
              { value: "embedding", label: t("aiSettings.embeddingModel") },
            ]}
          >
            <TabPanel value="chat" keepMounted>
              <ChatFormFields form={chat} onChange={setChat} />
            </TabPanel>
            <TabPanel value="embedding" keepMounted>
              <EmbeddingFormFields form={embedding} onChange={setEmbedding} />
            </TabPanel>
          </AppTabs>
        )}
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

      <div className="flex flex-col gap-2 border-t border-hairline pt-6">
        {saveError && (
          <p className="text-[13px] text-error">{t("aiSettings.saveFailed")}</p>
        )}
        <Button
          className="w-full"
          disabled={saving || !canSave}
          onClick={() => void saveAll()}
        >
          {saving ? t("common.saving") : t("aiSettings.saveAll")}
        </Button>
      </div>
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
