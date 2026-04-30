import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { LoadingSkeleton } from '@/components/ui/loading/loading-skeleton'
import { Separator } from '@/components/ui/separator'
import { toast } from '@/hooks/useToast'
import { adminApi, useMemoryActivity, useMemoryStats } from '@mosaic/api'
import { useQueryClient } from '@tanstack/react-query'
import { BookOpen, Brain, Clock, GitBranch, RefreshCw, Zap } from 'lucide-react'
import { useState } from 'react'

function relativeTime(ts: number): string {
  const seconds = Math.floor((Date.now() - ts) / 1000)
  if (seconds < 60) return '刚刚'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes} 分钟前`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} 小时前`
  const days = Math.floor(hours / 24)
  return `${days} 天前`
}

function formatSize(chars: number): string {
  if (chars >= 1000) return `${(chars / 1000).toFixed(1)}k`
  return `${chars}`
}

export function MemoryStatusPanel() {
  const queryClient = useQueryClient()
  const { data: stats, isLoading: statsLoading } = useMemoryStats()
  const { data: activity, isLoading: activityLoading } = useMemoryActivity(10)
  const [backfilling, setBackfilling] = useState(false)

  const handleBackfill = async () => {
    setBackfilling(true)
    try {
      await adminApi.backfillMemory()
      toast.success('索引回填已启动，后台处理中')
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['memory-stats'] })
      }, 3000)
    } catch {
      toast.error('启动失败，请检查 AI 配置中的 Embedding 模型')
    } finally {
      setBackfilling(false)
    }
  }

  if (statsLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5" />
            记忆状态
          </CardTitle>
        </CardHeader>
        <CardContent>
          <LoadingSkeleton lines={4} />
        </CardContent>
      </Card>
    )
  }

  const indexPercent =
    stats && stats.totalMemos > 0 ? Math.round((stats.indexedMemos / stats.totalMemos) * 100) : 0

  const isFullyIndexed = stats && stats.indexedMemos >= stats.totalMemos && stats.totalMemos > 0
  const hasUnindexed = stats && stats.totalMemos > 0 && stats.indexedMemos < stats.totalMemos

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Brain className="h-5 w-5" />
          <CardTitle>记忆状态</CardTitle>
        </div>
        <CardDescription>RAG 向量索引与 Bot 记忆概览</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Index progress */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-1.5 font-medium">
              <Zap className="h-3.5 w-3.5" />
              向量索引
            </span>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">
                {stats?.indexedMemos ?? 0} / {stats?.totalMemos ?? 0} 条
                {stats && stats.totalMemos > 0 && (
                  <span className="ml-1 text-xs">({indexPercent}%)</span>
                )}
              </span>
              {hasUnindexed && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-6 px-2 text-xs"
                  onClick={handleBackfill}
                  disabled={backfilling}
                >
                  <RefreshCw className={`h-3 w-3 mr-1 ${backfilling ? 'animate-spin' : ''}`} />
                  {backfilling ? '处理中...' : '补充索引'}
                </Button>
              )}
            </div>
          </div>
          <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${isFullyIndexed ? 'bg-green-500' : 'bg-primary'}`}
              style={{ width: `${indexPercent}%` }}
            />
          </div>
          {stats && stats.totalMemos === 0 && (
            <p className="text-xs text-muted-foreground">还没有 Memo，记录第一条后会自动建立索引</p>
          )}
          {hasUnindexed && (
            <p className="text-xs text-muted-foreground">
              {stats!.totalMemos - stats!.indexedMemos} 条待索引，新 Memo 会自动处理；历史 Memo
              可手动触发回填
            </p>
          )}
        </div>

        <Separator />

        {/* Episodes */}
        <div className="space-y-1.5">
          <span className="flex items-center gap-1.5 text-sm font-medium">
            <GitBranch className="h-3.5 w-3.5" />
            记忆事件线
          </span>
          <div className="flex gap-4 text-sm">
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-green-500" />
              <span className="text-muted-foreground">
                进行中{' '}
                <span className="font-medium text-foreground">{stats?.ongoingEpisodes ?? 0}</span>
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-muted-foreground/40" />
              <span className="text-muted-foreground">
                已结束{' '}
                <span className="font-medium text-foreground">{stats?.resolvedEpisodes ?? 0}</span>
              </span>
            </div>
          </div>
          {stats && stats.ongoingEpisodes === 0 && stats.resolvedEpisodes === 0 && (
            <p className="text-xs text-muted-foreground">事件线会在索引更多 Memo 后自动生成</p>
          )}
        </div>

        {/* Profile */}
        {(stats?.profileSummary || stats?.profileTopicCount !== undefined) && (
          <>
            <Separator />
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-sm font-medium">
                  <BookOpen className="h-3.5 w-3.5" />
                  长期画像
                </span>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  {stats.profileTopicCount > 0 && <span>{stats.profileTopicCount} 个话题信号</span>}
                  {stats.profileUpdatedAt && (
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {relativeTime(stats.profileUpdatedAt)}
                    </span>
                  )}
                </div>
              </div>
              {stats.profileSummary ? (
                <p className="text-sm text-muted-foreground leading-relaxed line-clamp-3 rounded-md bg-muted/50 px-3 py-2">
                  {stats.profileSummary}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  画像尚未建立，记录更多 Memo 后自动生成
                </p>
              )}
            </div>
          </>
        )}

        {/* Recent activity */}
        {!activityLoading && activity && activity.length > 0 && (
          <>
            <Separator />
            <div className="space-y-2">
              <span className="flex items-center gap-1.5 text-sm font-medium">
                <Clock className="h-3.5 w-3.5" />
                近期记忆调用
              </span>
              <div className="space-y-1.5">
                {activity.slice(0, 5).map(entry => (
                  <div
                    key={entry.id}
                    className="flex items-center justify-between text-xs text-muted-foreground"
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                      <span className="truncate">
                        <span className="font-medium text-foreground">{entry.botName}</span>
                        {' · '}
                        召回 {entry.retrievedCount} 条{entry.hasEpisode && ' · 含事件线'}
                        {' · '}
                        {formatSize(entry.promptSize)} 字符
                      </span>
                    </div>
                    <span className="shrink-0 ml-2">{relativeTime(entry.createdAt)}</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {!activityLoading && (!activity || activity.length === 0) && (
          <>
            <Separator />
            <p className="text-xs text-muted-foreground">
              Bot 回复 Memo 后，记忆调用记录会显示在这里
            </p>
          </>
        )}
      </CardContent>
    </Card>
  )
}
