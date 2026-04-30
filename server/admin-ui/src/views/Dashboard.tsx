import { Activity, Bot, FileText, Image, Loader, MessageSquare, Server, User as UserIcon } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { adminApi, api, type ActivityEntry, type ActivityResponse, type StatsSummary } from '../api'
import AIConfigPanel from '../components/AIConfigPanel'
import BotManager from '../components/BotManager'
import MemoryPanel from '../components/MemoryPanel'
import { useToast } from '../hooks/useToast'
import { useAuthStore } from '../stores/authStore'

interface KpiCardDef {
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

const kpiDefs: KpiCardDef[] = [
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
  backfill_episodes_started: '事件线摘要重建启动', backfill_episodes_completed: '事件线摘要重建完成',
  login: '登录', change_password: '修改密码',
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

  useEffect(() => {
    currentRef.current = current
  }, [current])

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

const tagColors: Record<string, string> = {
  info: 'bg-info/10 text-info',
  warn: 'bg-warning/10 text-warning',
  error: 'bg-destructive/10 text-destructive',
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
    } catch {
      /* ignore */
    }
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
    } catch {
      /* ignore */
    }
  }, [])

  useEffect(() => {
    void (async () => {
      await Promise.all([loadStats(), loadActivity(), loadHealth()])
    })()
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
    <div className="mx-auto max-w-[1200px]">
      <div className="mb-4 grid grid-cols-2 gap-2.5 sm:mb-5 sm:gap-3 lg:grid-cols-4">
        {kpiDefs.map((def, i) => (
          <KpiCard key={def.label} def={def} value={kpiValues[i]} />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <div className="rounded-lg border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <h3 className="flex items-center gap-1.5 text-[13px] font-semibold text-foreground">
              <Activity size={16} />
              最近活动
            </h3>
            <button className="border-none bg-transparent text-xs text-muted-foreground cursor-pointer hover:text-foreground transition-colors" onClick={loadActivity}>刷新</button>
          </div>
          <div className="max-h-[340px] overflow-y-auto px-4 py-3">
            {activityLoading && <div className="skeleton h-[120px]" />}
            {!activityLoading && !activityEntries.length && <div className="py-8 text-center text-sm text-muted-foreground">暂无活动记录</div>}
            {!activityLoading && activityEntries.length > 0 && (
              <div className="flex flex-col gap-px">
                {activityEntries.map((e, i) => (
                  <div key={`${e.timestamp}-${e.action}-${i}`} className="flex flex-wrap items-center gap-1.5 rounded-md px-2 py-[7px] text-xs transition-colors hover:bg-muted sm:gap-2">
                    <span className="font-mono text-[11px] text-muted-foreground shrink-0 sm:w-[58px]">{fmtTime(e.timestamp)}</span>
                    <span className={`rounded px-1.5 py-px text-[10px] font-semibold uppercase shrink-0 ${tagColors[e.level] || tagColors.info}`}>{e.level}</span>
                    <span className="font-medium text-foreground shrink-0">{actionLabels[e.action] || e.action}</span>
                    <span className="basis-full text-muted-foreground sm:basis-auto sm:min-w-0 sm:overflow-hidden sm:text-ellipsis sm:whitespace-nowrap">{e.detail}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <BotManager />

        <div className="rounded-lg border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <h3 className="flex items-center gap-1.5 text-[13px] font-semibold text-foreground">
              <UserIcon size={16} />
              账号
            </h3>
          </div>
          <div className="px-4 py-3">
            <div className="flex items-center justify-between py-0.5 text-[13px]">
              <span className="text-[11px] text-muted-foreground">用户</span>
              <span className="font-medium text-foreground">{auth.user?.username || '-'}</span>
            </div>
            <hr className="my-2.5 border-t border-border" />
            <form onSubmit={changePwd} className="flex flex-col gap-2">
              <div className="flex flex-col gap-1.5 sm:flex-row">
                <input
                  type="password"
                  className="h-7 rounded-md border border-border py-1 bg-muted px-2 text-xs text-foreground font-sans outline-none transition-colors focus:border-ring flex-1"
                  placeholder="当前密码"
                  value={pwdForm.oldPassword}
                  onChange={(e) => setPwdForm({ ...pwdForm, oldPassword: e.target.value })}
                />
                <input
                  type="password"
                  className="h-7 rounded-md border border-border py-1 bg-muted px-2 text-xs text-foreground font-sans outline-none transition-colors focus:border-ring flex-1"
                  placeholder="新密码"
                  value={pwdForm.newPassword}
                  onChange={(e) => setPwdForm({ ...pwdForm, newPassword: e.target.value })}
                />
              </div>
              <button type="submit" className="inline-flex items-center justify-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/80 disabled:opacity-50" disabled={pwdSaving}>
                {pwdSaving ? <Loader size={13} className="spin" /> : <span>修改密码</span>}
              </button>
            </form>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <h3 className="flex items-center gap-1.5 text-[13px] font-semibold text-foreground">
              <Server size={16} />
              系统状态
            </h3>
            <button className="border-none bg-transparent text-xs text-muted-foreground cursor-pointer hover:text-foreground transition-colors" onClick={loadHealth}>刷新</button>
          </div>
          <div className="px-4 py-3">
            {!health ? <div className="py-8 text-center text-sm text-muted-foreground">加载中...</div> : (
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                <HealthItem label="运行时间" value={health.uptime} />
                <HealthItem label="存储类型" value={health.storageType} />
                <HealthItem label="存储用量" value={health.storageUsedFormatted} />
                <HealthItem label="数据库" value={health.dbSizeFormatted} />
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="mt-3 space-y-3">
        <MemoryPanel />
        <AIConfigPanel />
      </div>
    </div>
  )
}

function KpiCard({ def, value }: { def: KpiCardDef; value: number }) {
  const animated = useAnimatedValue(value, def.label)
  return (
    <div className="flex items-center gap-2.5 rounded-lg bg-card px-3 py-3.5 shadow-sm transition-shadow hover:shadow-md sm:gap-3.5 sm:px-4 sm:py-[18px]">
      <div className="flex size-9 shrink-0 items-center justify-center rounded-md sm:size-[42px]" style={{ background: `color-mix(in srgb, ${def.color} 12%, transparent)`, color: def.color }}>
        <def.Icon size={18} />
      </div>
      <div className="flex min-w-0 flex-col">
        <span className="font-mono text-xl font-bold text-foreground leading-tight tabular-nums sm:text-2xl">{animated}</span>
        <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">{def.label}</span>
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
