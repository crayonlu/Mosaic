import {
  BookOpen,
  ChartLine,
  FileText,
  Image as ImageIcon,
  Robot,
  WarningCircle,
} from "@phosphor-icons/react"
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { Link } from "react-router-dom"
import {
  adminApi,
  api,
  type ActivityResponse,
  type HealthResponse,
  type MemoryStats,
  type StatsSummary,
} from "../../api"
import { EmptyState } from "../../components/ui/empty-state"
import { ErrorState } from "../../components/ui/error-state"
import { ProgressBar } from "../../components/ui/progress"
import { Skeleton } from "../../components/ui/skeleton"
import { StatCard } from "../../components/ui/stat-card"
import { useAuthStore } from "../../stores/authStore"
import { useAsyncData } from "../../hooks/useAsyncData"
import { formatClock } from "../../lib/utils"

const levelColors: Record<string, string> = {
  info: "bg-info/10 text-info",
  warn: "bg-warning/10 text-warning",
  error: "bg-error/10 text-error",
}

function useCountUp(target: number) {
  const [value, setValue] = useState(0)
  const fromRef = useRef(0)

  useEffect(() => {
    const from = fromRef.current
    if (from === target) return
    const start = performance.now()
    const duration = 300
    let raf = 0
    function step(now: number) {
      const p = Math.min((now - start) / duration, 1)
      const eased = 1 - Math.pow(1 - p, 3)
      const v = Math.round(from + (target - from) * eased)
      setValue(v)
      fromRef.current = v
      if (p < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [target])

  return value
}

function KpiCell({
  value,
  label,
  icon,
}: {
  value: number
  label: string
  icon: ReactNode
}) {
  const animated = useCountUp(value)
  return <StatCard value={animated} label={label} icon={icon} />
}

export default function OverviewView() {
  const { t } = useTranslation()
  const isAdmin = useAuthStore((s) => s.user?.role === "admin")

  if (!isAdmin) {
    return (
      <EmptyState
        icon={<ChartLine size={18} />}
        title={t("overview.noAccess")}
        action={
          <Link
            to="/bots"
            className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-on-primary transition-colors hover:bg-primary-hover"
          >
            {t("overview.goBots")}
          </Link>
        }
      />
    )
  }

  return <AdminOverview />
}

function AdminOverview() {
  const { t } = useTranslation()

  const stats = useAsyncData<StatsSummary>(
    useCallback(() => adminApi("/stats") as Promise<StatsSummary>, [])
  )
  const activity = useAsyncData<ActivityResponse>(
    useCallback(
      () =>
        adminApi("/activity", {
          params: { limit: 20 },
        }) as Promise<ActivityResponse>,
      []
    )
  )
  const health = useAsyncData<HealthResponse>(
    useCallback(() => adminApi("/health") as Promise<HealthResponse>, [])
  )
  const memory = useAsyncData<MemoryStats>(
    useCallback(() => api("/memory/stats") as Promise<MemoryStats>, [])
  )

  const actionLabels: Record<string, string> = {
    create_memo: t("actions.createMemo"),
    update_memo: t("actions.updateMemo"),
    delete_memo: t("actions.deleteMemo"),
    create_diary: t("actions.createDiary"),
    update_diary: t("actions.updateDiary"),
    delete_diary: t("actions.deleteDiary"),
    create_bot: t("actions.createBot"),
    update_bot: t("actions.updateBot"),
    delete_bot: t("actions.deleteBot"),
    trigger_replies: t("actions.botReply"),
    reply_to_bot: t("actions.userReplyBot"),
    backfill_memory_started: t("actions.memoryBackfillStart"),
    backfill_memory_completed: t("actions.memoryBackfillComplete"),
    login: t("actions.login"),
    change_password: t("actions.changePassword"),
  }

  const indexPercent =
    memory.data && memory.data.totalMemos > 0
      ? Math.round((memory.data.indexedMemos / memory.data.totalMemos) * 100)
      : 0
  const hasUnindexed =
    !!memory.data &&
    memory.data.totalMemos > 0 &&
    memory.data.indexedMemos < memory.data.totalMemos

  const kpiDefs = [
    { label: t("overview.kpiMemo"), icon: <FileText size={16} /> },
    { label: t("overview.kpiDiary"), icon: <BookOpen size={16} /> },
    { label: t("overview.kpiResource"), icon: <ImageIcon size={16} /> },
    { label: t("overview.kpiBot"), icon: <Robot size={16} /> },
  ]

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 gap-x-4 gap-y-6 lg:grid-cols-4">
        {kpiDefs.map((def, i) => (
          <KpiCell
            key={def.label}
            label={def.label}
            icon={def.icon}
            value={
              stats.data
                ? [
                    stats.data.memos.total,
                    stats.data.diaries.total,
                    stats.data.resources.total,
                    stats.data.bots.total,
                  ][i]
                : 0
            }
          />
        ))}
      </div>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-[15px] font-semibold text-ink">
            {t("overview.activity")}
          </h2>
          <button
            type="button"
            onClick={() => activity.refetch()}
            className="h-9 rounded-md px-2.5 text-[13px] font-medium text-ink-tertiary transition-colors hover:bg-subtle hover:text-ink md:h-8"
          >
            {t("overview.refresh")}
          </button>
        </div>
        {activity.loading && !activity.data ? (
          <div className="space-y-2">
            <Skeleton className="h-6" />
            <Skeleton className="h-6" />
            <Skeleton className="h-6" />
          </div>
        ) : activity.error ? (
          <ErrorState message={activity.error} onRetry={activity.refetch} />
        ) : !activity.data || activity.data.entries.length === 0 ? (
          <EmptyState title={t("overview.noActivity")} />
        ) : (
          <ul className="divide-y divide-hairline">
            {activity.data.entries.map((e, i) => (
              <li
                key={`${e.timestamp}-${e.action}-${i}`}
                className="flex min-w-0 items-center gap-3 py-2"
              >
                <span className="shrink-0 font-mono text-xs text-ink-tertiary tabular-nums">
                  {formatClock(e.timestamp)}
                </span>
                <span
                  className={`shrink-0 rounded px-1.5 py-px text-[11px] font-semibold uppercase ${levelColors[e.level] ?? levelColors.info}`}
                >
                  {e.level}
                </span>
                <span className="min-w-0 truncate text-[13px] text-ink">
                  {actionLabels[e.action] ?? e.action}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-[15px] font-semibold text-ink">
            {t("overview.systemStatus")}
          </h2>
          <button
            type="button"
            onClick={() => health.refetch()}
            className="h-9 rounded-md px-2.5 text-[13px] font-medium text-ink-tertiary transition-colors hover:bg-subtle hover:text-ink md:h-8"
          >
            {t("overview.refresh")}
          </button>
        </div>
        {health.loading && !health.data ? (
          <Skeleton className="h-20" />
        ) : health.error ? (
          <ErrorState message={health.error} onRetry={health.refetch} />
        ) : health.data ? (
          <div className="grid grid-cols-2 gap-x-8 gap-y-4 sm:grid-cols-4">
            <HealthItem
              label={t("overview.uptime")}
              value={health.data.uptime}
            />
            <HealthItem
              label={t("overview.storageType")}
              value={health.data.storageType}
            />
            <HealthItem
              label={t("overview.storageUsage")}
              value={health.data.storageUsedFormatted}
            />
            <HealthItem
              label={t("overview.database")}
              value={health.data.dbSizeFormatted}
            />
          </div>
        ) : null}
      </section>

      <section className="space-y-3">
        <h2 className="text-[15px] font-semibold text-ink">
          {t("overview.memoryTitle")}
        </h2>
        {memory.loading && !memory.data ? (
          <Skeleton className="h-12" />
        ) : memory.error ? (
          <ErrorState message={memory.error} onRetry={memory.refetch} />
        ) : memory.data ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <span className="text-[13px] font-medium text-ink">
                {t("overview.vectorIndex")}
              </span>
              <span className="text-[13px] text-ink-tertiary tabular-nums">
                {t("overview.memoryItems", {
                  n: memory.data.indexedMemos,
                  m: memory.data.totalMemos,
                })}
              </span>
            </div>
            <ProgressBar value={indexPercent} />
            {memory.data.totalMemos === 0 && (
              <p className="text-xs text-ink-tertiary">
                {t("overview.memoryEmpty")}
              </p>
            )}
            {hasUnindexed && (
              <p className="flex items-center gap-2 text-xs text-ink-tertiary">
                <WarningCircle size={13} />
                {t("overview.memoryPending", {
                  n: memory.data.totalMemos - memory.data.indexedMemos,
                })}
                <Link
                  to="/settings/ai"
                  className="font-medium text-primary hover:text-primary-hover"
                >
                  {t("overview.goBackfill")}
                </Link>
              </p>
            )}
          </div>
        ) : null}
      </section>
    </div>
  )
}

function HealthItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-ink-tertiary">{label}</span>
      <span className="font-mono text-[13px] font-medium text-ink">
        {value}
      </span>
    </div>
  )
}
