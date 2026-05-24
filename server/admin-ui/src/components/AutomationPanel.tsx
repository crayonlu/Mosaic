import { Loader, Zap } from "lucide-react"
import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { adminApi } from "../api"
import { useToast } from "../hooks/useToast"

interface AutomationSettings {
  autoTagEnabled: boolean
  autoSummaryEnabled: boolean
  autoDiaryEnabled: boolean
  autoDiaryMinMemos: number
  autoDiaryMinChars: number
  appTimezone: string
}

export default function AutomationPanel() {
  const { t } = useTranslation()
  const toast = useToast()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [settings, setSettings] = useState<AutomationSettings>({
    autoTagEnabled: true,
    autoSummaryEnabled: false,
    autoDiaryEnabled: true,
    autoDiaryMinMemos: 2,
    autoDiaryMinChars: 150,
    appTimezone: "Asia/Shanghai",
  })

  useEffect(() => {
    let active = true
    void (async () => {
      try {
        const data = (await adminApi("/settings")) as AutomationSettings
        if (active) setSettings(data)
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

  async function save() {
    setSaving(true)
    try {
      await adminApi("/settings", { method: "PUT", body: settings })
      toast.success(t("automation.saved"))
    } catch {
      toast.error(t("automation.saveFailed"))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-lg border border-border">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h3 className="flex items-center gap-1.5 text-[13px] font-semibold text-foreground">
          <Zap size={16} />
          {t("automation.title")}
        </h3>
      </div>
      <div className="px-4 py-4">
        {loading ? (
          <div className="skeleton h-[80px]" />
        ) : (
          <div className="flex flex-col gap-4">
            <ToggleRow
              label={t("automation.autoTag")}
              description={t("automation.autoTagDesc")}
              checked={settings.autoTagEnabled}
              onChange={(v) =>
                setSettings((s) => ({ ...s, autoTagEnabled: v }))
              }
            />
            <ToggleRow
              label={t("automation.autoSummary")}
              description={t("automation.autoSummaryDesc")}
              checked={settings.autoSummaryEnabled}
              onChange={(v) =>
                setSettings((s) => ({ ...s, autoSummaryEnabled: v }))
              }
            />
            <ToggleRow
              label={t("automation.autoDiary")}
              description={t("automation.autoDiaryDesc")}
              checked={settings.autoDiaryEnabled}
              onChange={(v) =>
                setSettings((s) => ({ ...s, autoDiaryEnabled: v }))
              }
            />
            <NumberRow
              label={t("automation.minMemos")}
              description={t("automation.minMemosDesc")}
              value={settings.autoDiaryMinMemos}
              onChange={(v) =>
                setSettings((s) => ({ ...s, autoDiaryMinMemos: v }))
              }
              min={1}
            />
            <NumberRow
              label={t("automation.minChars")}
              description={t("automation.minCharsDesc")}
              value={settings.autoDiaryMinChars}
              onChange={(v) =>
                setSettings((s) => ({ ...s, autoDiaryMinChars: v }))
              }
              min={1}
            />
            <TextRow
              label={t("automation.timezone")}
              description={t("automation.timezonePlaceholder")}
              value={settings.appTimezone}
              onChange={(v) => setSettings((s) => ({ ...s, appTimezone: v }))}
            />
            <button
              className="inline-flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-[13px] font-semibold text-primary-foreground transition-colors hover:bg-primary/80 disabled:opacity-50"
              disabled={saving}
              onClick={save}
            >
              {saving ? (
                <Loader size={14} className="spin" />
              ) : (
                <span>{t("automation.save")}</span>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function NumberRow({
  label,
  description,
  value,
  onChange,
  min,
}: {
  label: string
  description: string
  value: number
  onChange: (v: number) => void
  min?: number
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex flex-col gap-0.5">
        <span className="text-[13px] font-medium text-foreground">{label}</span>
        <span className="text-[11px] text-muted-foreground">{description}</span>
      </div>
      <input
        type="number"
        min={min}
        value={value}
        onChange={(e) => onChange(Number(e.target.value) || min || 1)}
        className="w-24 rounded-lg border border-border bg-background px-3 py-1.5 text-right text-[13px] text-foreground"
      />
    </div>
  )
}

function TextRow({
  label,
  description,
  value,
  onChange,
}: {
  label: string
  description: string
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex flex-col gap-0.5">
        <span className="text-[13px] font-medium text-foreground">{label}</span>
        <span className="text-[11px] text-muted-foreground">{description}</span>
      </div>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-44 rounded-lg border border-border bg-background px-3 py-1.5 text-right text-[13px] text-foreground"
      />
    </div>
  )
}

function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string
  description: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex flex-col gap-0.5">
        <span className="text-[13px] font-medium text-foreground">{label}</span>
        <span className="text-[11px] text-muted-foreground">{description}</span>
      </div>
      <button
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none ${
          checked ? "bg-primary" : "bg-muted-foreground/30"
        }`}
      >
        <span
          className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
            checked ? "translate-x-4" : "translate-x-0"
          }`}
        />
      </button>
    </div>
  )
}
