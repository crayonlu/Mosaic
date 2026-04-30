import { Bot, FileText, Image, Loader, MessageSquare, RefreshCw, Server, User as UserIcon } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { adminApi, api, type ActivityEntry, type ActivityResponse, type StatsSummary } from '../api'
import AIConfigPanel from '../components/AIConfigPanel'
import AutomationPanel from '../components/AutomationPanel'
import BotManager from '../components/BotManager'
import MemoryPanel from '../components/MemoryPanel'
import { useToast } from '../hooks/useToast'
import { useAuthStore } from '../stores/authStore'

interface KpiDef {
  label: string
  color: string
  Icon: React.FC<{ size?: number }>
}

interface HealthResponse {
  uptime: string
  storageType: string
  storageUsedFormatted: string
  dbSizeFormatted: string
}

const animationCache = new Map<string, number>()

const kpiDefs: KpiDef[] = [
  { label: 'Memo', color: '#7C3AED', Icon: FileText },
  { label: '日记', color: '#F97316', Icon: MessageSquare },
  { label: '资源', color: '#10B981', Icon: Image },
  { label: 'Bot', color: '#3B82F6', Icon: Bot },
]

const actionLabels: Record<string, string> = {
  create_memo: '创建 Memo', update_memo: '更新 Memo', delete_memo: '删除 Memo',
  create_diary: '创建日记', update_diary: '更新日记', delete_diary: '删除日记',
  create_bot: '创建 Bot', update_bot: '更新 Bot', delete_bot: '删除 Bot',
  trigger_replies: 'Bot 自动回复', reply_to_bot: '用户回复 Bot',
  backfill_memory_started: '记忆回填启动', backfill_memory_completed: '记忆回填完成',
  login: '登录', change_password: '修改密码',
}

const levelColors: Record<string, string> = {
  info: 'bg-info/10 text-info',
  warn: 'bg-warning/10 text-warning',
  error: 'bg-destructive/10 text-destructive',
}

function fmtTime(ts: number) {
  const d = new Date(ts)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function easeOutCubic(t: number) {
  return 1 - Math.pow(1 - t, 3)
}

function useAnimatedValue(target: number, key: string) {
  const [current, setCurrent] = useState(() => animationCache.get(key) ?? 0)
  const currentRef = useRef(current)
  const rafRef = useRef(0)

  useEffect(() => { currentRef.current = current }, [current])

  useEffect(() => {
    const start = currentRef.current
    const startTime = performance.now()
    const duration = 600

    function step(now: number) {
      const p = Math.min((now - startTime) / duration, 1)
      const v = Math.round(start + (target - start) * easeOutCubic(p))
      setCurrent(v)
      animationCache.set(key, v)
      if (p < 1) rafRef.current = requestAnimationFrame(step)
    }
    rafRef.current = requestAnimationFrame(step)
    return () => cancelAnimationFrame(rafRef.current)
  }, [key, target])

  return current
}

export default function Dashboard() {
  const auth = useAuthStore()
  const toast = useToast()

  const [kpiValues, setKpiValues] = useState([0, 0, 0, 0])
  const [activityEntries, setActivityEntries] = useState<ActivityEntry[]>([])
  const [activityLoading, setActivityLoading] = useState(false)
  const [health, setHealth] = useState<HealthResponse | null>(null)
  const [pwdForm, setPwdForm] = useState({ oldPassword: '', newPassword: '' })
  const [pwdSaving, setPwdSaving] = useState(false)

  const loadStats = useCallback(async () => {
    try {
      const data = (await adminApi('/stats')) as StatsSummary
      setKpiValues([data.memos.total, data.diaries.total, data.resources.total, data.bots.total])
    } catch { /* ignore */ }
  }, [])

  const loadActivity = useCallback(async () => {
    setActivityLoading(true)
    try {
      const data = (await adminApi('/activity', { params: { limit: 20 } })) as ActivityResponse
      setActivityEntries(data.entries || [])
    } catch {
      setActivityEntries([])
    } finally {
      setActivityLoading(false)
    }
  }, [])

  const loadHealth = useCallback(async () => {
    try {
      setHealth((await adminApi('/health')) as HealthResponse)
    } catch { /* ignore */ }
  }, [])

  useEffect(() => {
    void Promise.all([loadStats(), loadActivity(), loadHealth()])
  }, [loadStats, loadActivity, loadHealth])

  async function changePwd(e: React.FormEvent) {
    e.preventDefault()
    if (!pwdForm.oldPassword || !pwdForm.newPassword) {
      toast.error('请填写完整')
      return
    }
    setPwdSaving(true)
    try {
      await api('/auth/change-password', { method: 'POST', body: pwdForm })
      toast.success('密码已修改')
      setPwdForm({ oldPassword: '', newPassword: '' })
    } catch {
      toast.error('修改失败，请检查当前密码')
    } finally {
      setPwdSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-300 space-y-3 py-5 sm:space-y-4 sm:py-7">

      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="grid grid-cols-2 border-b border-border lg:grid-cols-4">
          {kpiDefs.map((def, i) => (
            <KpiItem
              key={def.label}
              def={def}
              value={kpiValues[i]}
              borderRight={i === 0 || i === 2 || (i < 3)}
              borderBottom={i < 2}
            />
          ))}
        </div>

        <div className="flex items-start gap-3 px-4 py-3 min-h-11">
          <span className="shrink-0 pt-px text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            活动
          </span>
          <div className="flex-1 min-w-0">
            {activityLoading ? (
              <div className="flex gap-3">
                <div className="skeleton h-4 w-40 rounded" />
                <div className="skeleton h-4 w-32 rounded" />
              </div>
            ) : activityEntries.length === 0 ? (
              <span className="text-[12px] text-muted-foreground">暂无活动记录</span>
            ) : (
              <div className="flex flex-col gap-1.5 lg:flex-row lg:flex-wrap lg:items-center lg:gap-x-5 lg:gap-y-1">
                {activityEntries.slice(0, 5).map((e, i) => (
                  <div key={`${e.timestamp}-${e.action}-${i}`} className="flex items-center gap-1.5 min-w-0">
                    <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
                      {fmtTime(e.timestamp)}
                    </span>
                    <span className={`shrink-0 rounded px-1.5 py-px text-[10px] font-semibold uppercase ${levelColors[e.level] || levelColors.info}`}>
                      {e.level}
                    </span>
                    <span className="truncate text-[12px] text-foreground">
                      {actionLabels[e.action] || e.action}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <button
            onClick={loadActivity}
            className="shrink-0 flex size-6 items-center justify-center rounded border-none bg-transparent text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            title="刷新"
          >
            <RefreshCw size={12} />
          </button>
        </div>
      </div>

      <AIConfigPanel />

      <div className="grid gap-3 sm:grid-cols-2">
        <AutomationPanel />
        <MemoryPanel />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <BotManager />
        <SystemCard health={health} onRefresh={loadHealth} />
      </div>

      <AccountCard
        username={auth.user?.username}
        pwdForm={pwdForm}
        setPwdForm={setPwdForm}
        pwdSaving={pwdSaving}
        onChangePwd={changePwd}
      />

    </div>
  )
}

function KpiItem({
  def,
  value,
  borderRight,
  borderBottom,
}: {
  def: KpiDef
  value: number
  borderRight: boolean
  borderBottom: boolean
}) {
  const animated = useAnimatedValue(value, def.label)
  return (
    <div
      className={[
        'flex items-center gap-3 px-4 py-3.5',
        borderRight ? 'border-r border-border' : '',
        borderBottom ? 'border-b border-border lg:border-b-0' : '',
      ].join(' ')}
    >
      <div
        className="flex size-8 shrink-0 items-center justify-center rounded-md"
        style={{
          background: `color-mix(in srgb, ${def.color} 12%, transparent)`,
          color: def.color,
        }}
      >
        <def.Icon size={15} />
      </div>
      <div className="flex flex-col">
        <span className="font-mono text-lg font-bold text-foreground tabular-nums leading-tight">
          {animated}
        </span>
        <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          {def.label}
        </span>
      </div>
    </div>
  )
}

function SystemCard({
  health,
  onRefresh,
}: {
  health: HealthResponse | null
  onRefresh: () => void
}) {
  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h3 className="flex items-center gap-1.5 text-[13px] font-semibold text-foreground">
          <Server size={15} />
          系统状态
        </h3>
        <button
          className="border-none bg-transparent text-xs text-muted-foreground transition-colors hover:text-foreground"
          onClick={onRefresh}
        >
          刷新
        </button>
      </div>
      <div className="px-4 py-3">
        {!health ? (
          <div className="skeleton h-20 rounded" />
        ) : (
          <div className="grid grid-cols-2 gap-x-4 gap-y-3">
            <HealthItem label="运行时间" value={health.uptime} />
            <HealthItem label="存储类型" value={health.storageType} />
            <HealthItem label="存储用量" value={health.storageUsedFormatted} />
            <HealthItem label="数据库" value={health.dbSizeFormatted} />
          </div>
        )}
      </div>
    </div>
  )
}

function HealthItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <span className="font-mono text-xs font-semibold text-foreground">{value}</span>
    </div>
  )
}

function AccountCard({
  username,
  pwdForm,
  setPwdForm,
  pwdSaving,
  onChangePwd,
}: {
  username?: string
  pwdForm: { oldPassword: string; newPassword: string }
  setPwdForm: (f: { oldPassword: string; newPassword: string }) => void
  pwdSaving: boolean
  onChangePwd: (e: React.FormEvent) => void
}) {
  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="flex items-center border-b border-border px-4 py-3">
        <h3 className="flex items-center gap-1.5 text-[13px] font-semibold text-foreground">
          <UserIcon size={15} />
          账号
        </h3>
      </div>
      <div className="px-4 py-3">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-[11px] text-muted-foreground">当前用户</span>
          <span className="text-[13px] font-medium text-foreground">{username || '-'}</span>
        </div>
        <hr className="border-t border-border" />
        <p className="mb-2.5 mt-3 text-[11px] font-medium text-muted-foreground">修改密码</p>
        <form onSubmit={onChangePwd} className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="flex flex-1 flex-col gap-2 sm:flex-row">
            <input
              type="password"
              className="h-8 flex-1 rounded-md border border-border bg-muted px-2.5 text-[13px] text-foreground font-sans outline-none transition-colors focus:border-ring"
              placeholder="当前密码"
              value={pwdForm.oldPassword}
              onChange={(e) => setPwdForm({ ...pwdForm, oldPassword: e.target.value })}
            />
            <input
              type="password"
              className="h-8 flex-1 rounded-md border border-border bg-muted px-2.5 text-[13px] text-foreground font-sans outline-none transition-colors focus:border-ring"
              placeholder="新密码"
              value={pwdForm.newPassword}
              onChange={(e) => setPwdForm({ ...pwdForm, newPassword: e.target.value })}
            />
          </div>
          <button
            type="submit"
            className="inline-flex h-8 items-center justify-center gap-1.5 rounded-md bg-primary px-4 text-[13px] font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
            disabled={pwdSaving}
          >
            {pwdSaving ? <Loader size={13} className="spin" /> : '修改'}
          </button>
        </form>
      </div>
    </div>
  )
}
