import { Brain, Loader, RefreshCw, Zap } from "lucide-react"
import { useCallback, useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { adminApi, api } from "../api"
import { useToast } from "../hooks/useToast"

interface MemoryStats {
  totalMemos: number
  indexedMemos: number
}

export default function MemoryPanel() {
  const { t } = useTranslation()
  const toast = useToast()
  const [stats, setStats] = useState<MemoryStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [backfilling, setBackfilling] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setStats((await api("/memory/stats")) as MemoryStats)
    } catch {
      /* ignore */
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()
  }, [load])

  const handleBackfill = async () => {
    setBackfilling(true)
    try {
      await adminApi("/backfill-memory", { method: "POST" })
      toast.success(t("memory.backfillStarted"))
      setTimeout(() => void load(), 3000)
    } catch {
      toast.error(t("memory.backfillFailed"))
    } finally {
      setBackfilling(false)
    }
  }

  const indexPercent =
    stats && stats.totalMemos > 0
      ? Math.round((stats.indexedMemos / stats.totalMemos) * 100)
      : 0
  const isFullyIndexed =
    stats && stats.indexedMemos >= stats.totalMemos && stats.totalMemos > 0
  const hasUnindexed =
    stats && stats.totalMemos > 0 && stats.indexedMemos < stats.totalMemos

  return (
    <div className="rounded-lg border border-border">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h3 className="flex items-center gap-1.5 text-[13px] font-semibold text-foreground">
          <Brain size={16} />
          {t("memory.title")}
        </h3>
        <button
          className="cursor-pointer border-none bg-transparent text-xs text-muted-foreground transition-colors hover:text-foreground"
          onClick={load}
        >
          {t("memory.refresh")}
        </button>
      </div>

      <div className="space-y-3 px-4 py-3">
        {loading ? (
          <div className="skeleton h-[80px]" />
        ) : (
          <>
            {/* Index progress */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[12px]">
                <span className="flex items-center gap-1 font-medium text-foreground">
                  <Zap size={12} />
                  {t("memory.vectorIndex")}
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">
                    {t("memory.items", {
                      n: stats?.indexedMemos ?? 0,
                      m: stats?.totalMemos ?? 0,
                      p: indexPercent,
                    })}
                  </span>
                  {hasUnindexed && (
                    <button
                      className="inline-flex items-center gap-1 rounded border border-border bg-muted px-2 py-0.5 text-[11px] font-medium text-foreground transition-colors hover:bg-muted/70 disabled:opacity-50"
                      onClick={handleBackfill}
                      disabled={backfilling}
                    >
                      {backfilling ? (
                        <Loader size={10} className="spin" />
                      ) : (
                        <RefreshCw size={10} />
                      )}
                      {backfilling
                        ? t("memory.processing")
                        : t("memory.backfill")}
                    </button>
                  )}
                </div>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${indexPercent}%`,
                    background: isFullyIndexed ? "#10B981" : "var(--primary)",
                  }}
                />
              </div>
              {stats && stats.totalMemos === 0 && (
                <p className="text-[11px] text-muted-foreground">
                  {t("memory.empty")}
                </p>
              )}
              {hasUnindexed && (
                <p className="text-[11px] text-muted-foreground">
                  {t("memory.pendingIndex", {
                    n: stats!.totalMemos - stats!.indexedMemos,
                  })}
                </p>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
