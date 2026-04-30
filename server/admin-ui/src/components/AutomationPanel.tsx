import { Loader, Zap } from 'lucide-react'
import { useEffect, useState } from 'react'
import { adminApi } from '../api'
import { useToast } from '../hooks/useToast'

interface AutomationSettings {
  autoTagEnabled: boolean
  autoSummaryEnabled: boolean
}

export default function AutomationPanel() {
  const toast = useToast()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [settings, setSettings] = useState<AutomationSettings>({
    autoTagEnabled: true,
    autoSummaryEnabled: false,
  })

  useEffect(() => {
    let active = true
    void (async () => {
      try {
        const data = (await adminApi('/settings')) as AutomationSettings
        if (active) setSettings(data)
      } catch {
        /* ignore */
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => { active = false }
  }, [])

  async function save() {
    setSaving(true)
    try {
      await adminApi('/settings', { method: 'PUT', body: settings })
      toast.success('设置已保存')
    } catch {
      toast.error('保存失败')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h3 className="flex items-center gap-1.5 text-[13px] font-semibold text-foreground">
          <Zap size={16} />
          自动化设置
        </h3>
      </div>
      <div className="px-4 py-4">
        {loading ? (
          <div className="skeleton h-[80px]" />
        ) : (
          <div className="flex flex-col gap-4">
            <ToggleRow
              label="自动标签"
              description="创建 Memo 时，若无标签则自动生成 1-4 个标签"
              checked={settings.autoTagEnabled}
              onChange={(v) => setSettings((s) => ({ ...s, autoTagEnabled: v }))}
            />
            <ToggleRow
              label="自动 AI 摘要"
              description="创建 Memo 时自动生成一句话摘要"
              checked={settings.autoSummaryEnabled}
              onChange={(v) => setSettings((s) => ({ ...s, autoSummaryEnabled: v }))}
            />
            <button
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-[13px] font-semibold text-primary-foreground transition-colors cursor-pointer hover:bg-primary/80 disabled:opacity-50"
              disabled={saving}
              onClick={save}
            >
              {saving ? <Loader size={14} className="spin" /> : <span>保存设置</span>}
            </button>
          </div>
        )}
      </div>
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
          checked ? 'bg-primary' : 'bg-muted-foreground/30'
        }`}
      >
        <span
          className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
            checked ? 'translate-x-4' : 'translate-x-0'
          }`}
        />
      </button>
    </div>
  )
}
