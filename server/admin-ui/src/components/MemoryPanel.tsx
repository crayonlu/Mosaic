import { Brain, Loader, RefreshCw, Zap } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { adminApi, api } from '../api'
import { useToast } from '../hooks/useToast'

interface MemoryStats {
  totalMemos: number
  indexedMemos: number
}

export default function MemoryPanel() {
  const toast = useToast()
  const [stats, setStats] = useState<MemoryStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [backfilling, setBackfilling] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setStats((await api('/memory/stats')) as MemoryStats)
    } catch {
      /* ignore */
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const handleBackfill = async () => {
    setBackfilling(true)
    try {
      await adminApi('/backfill-memory', { method: 'POST' })
      toast.success('索引回填已启动，后台处理中')
      setTimeout(() => void load(), 3000)
    } catch {
      toast.error('启动失败，请检查 Embedding 模型配置')
    } finally {
      setBackfilling(false)
    }
  }

  const indexPercent =
    stats && stats.totalMemos > 0
      ? Math.round((stats.indexedMemos / stats.totalMemos) * 100)
      : 0
  const isFullyIndexed = stats && stats.indexedMemos >= stats.totalMemos && stats.totalMemos > 0
  const hasUnindexed = stats && stats.totalMemos > 0 && stats.indexedMemos < stats.totalMemos

  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h3 className="flex items-center gap-1.5 text-[13px] font-semibold text-foreground">
          <Brain size={16} />
          记忆 / RAG 索引
        </h3>
        <button
          className="border-none bg-transparent text-xs text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
          onClick={load}
        >
          刷新
        </button>
      </div>

      <div className="px-4 py-3 space-y-3">
        {loading ? (
          <div className="skeleton h-[80px]" />
        ) : (
          <>
            {/* Index progress */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[12px]">
                <span className="flex items-center gap-1 font-medium text-foreground">
                  <Zap size={12} />
                  向量索引
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">
                    {stats?.indexedMemos ?? 0} / {stats?.totalMemos ?? 0} 条
                    {stats && stats.totalMemos > 0 && (
                      <span className="ml-1">({indexPercent}%)</span>
                    )}
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
                      {backfilling ? '处理中...' : '补充索引'}
                    </button>
                  )}
                </div>
              </div>
              <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${indexPercent}%`,
                    background: isFullyIndexed ? '#10B981' : 'var(--primary)',
                  }}
                />
              </div>
              {stats && stats.totalMemos === 0 && (
                <p className="text-[11px] text-muted-foreground">
                  还没有 Memo，记录第一条后会自动建立索引
                </p>
              )}
              {hasUnindexed && (
                <p className="text-[11px] text-muted-foreground">
                  {stats!.totalMemos - stats!.indexedMemos} 条历史 Memo 未索引，可手动触发回填
                </p>
              )}
            </div>

          </>
        )}
      </div>
    </div>
  )
}
