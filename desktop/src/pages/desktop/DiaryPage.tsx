import { EmptyState } from '@/components/common/EmptyState'
import DeskTopLayout from '@/components/layout/DeskTopLayout'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { LoadingMemoList } from '@/components/ui/loading/loading-skeleton'
import { toast } from '@/hooks/use-toast'
import type { Diary, PaginatedResponse } from '@/types'
import { diaryCommands } from '@/utils/callRust'
import { MOOD_EMOJIS } from '@/utils/moodEmoji'
import dayjs from 'dayjs'
import { BookOpen, Calendar } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

export default function DiaryPage() {
  const [diaries, setDiaries] = useState<Diary[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(20)
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [startDate, setStartDate] = useState<string>()
  const [endDate, setEndDate] = useState<string>()
  const navigate = useNavigate()

  const fetchDiaries = async (pageNum: number = page) => {
    try {
      setLoading(true)
      const response: PaginatedResponse<Diary> = await diaryCommands.listDiaries({
        page: pageNum,
        pageSize,
        startDate,
        endDate,
      })
      setDiaries(response.items)
      setTotal(response.total)
      setTotalPages(response.totalPages)
      setPage(response.page)
    } catch (error) {
      console.error('获取日记列表失败:', error)
      toast.error('获取日记列表失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDiaries(1)
  }, [startDate, endDate])

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      fetchDiaries(newPage)
    }
  }

  const handleDiaryClick = (date: string) => {
    navigate(`/diaries/${date}`)
  }

  const moodStats = useMemo(() => {
    const stats = new Map<string, number>()
    diaries.forEach(diary => {
      if (diary.moodKey) {
        const current = stats.get(diary.moodKey) || 0
        stats.set(diary.moodKey, current + 1)
      }
    })
    return stats
  }, [diaries])

  const mostCommonMood = useMemo(() => {
    let maxCount = 0
    let mostCommon = ''
    moodStats.forEach((value: number, key: string) => {
      if (value > maxCount) {
        maxCount = value
        mostCommon = key
      }
    })
    return mostCommon
  }, [moodStats])

  if (loading && diaries.length === 0) {
    return (
      <DeskTopLayout className="relative">
        <div className="h-full flex items-center justify-center">
          <LoadingMemoList count={5} />
        </div>
      </DeskTopLayout>
    )
  }

  return (
    <DeskTopLayout className="relative">
      <div className="h-full flex flex-col">
        <div className="border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60 sticky top-0 z-10">
          <div className="flex items-center justify-between px-6 pb-4 pt-2">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <BookOpen className="h-5 w-5" />
                <span className="text-lg font-semibold">日记</span>
              </div>

              <Badge variant="secondary" className="text-xs">
                共 {total} 篇
              </Badge>

              {mostCommonMood && (
                <Badge variant="outline" className="text-xs">
                  常见心情: {MOOD_EMOJIS[mostCommonMood]?.emoji}{' '}
                  {MOOD_EMOJIS[mostCommonMood]?.label}
                </Badge>
              )}
            </div>

            <div className="flex items-center gap-2">
              <input
                type="date"
                value={startDate || ''}
                onChange={e => setStartDate(e.target.value || undefined)}
                className="px-3 py-1.5 text-sm border rounded-md bg-background"
                placeholder="开始日期"
              />
              <span className="text-muted-foreground">-</span>
              <input
                type="date"
                value={endDate || ''}
                onChange={e => setEndDate(e.target.value || undefined)}
                className="px-3 py-1.5 text-sm border rounded-md bg-background"
                placeholder="结束日期"
              />
              {(startDate || endDate) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setStartDate(undefined)
                    setEndDate(undefined)
                  }}
                >
                  清除
                </Button>
              )}
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {!loading && diaries.length === 0 ? (
            <EmptyState icon={BookOpen} title="暂无日记" description="开始记录你的每一天吧" />
          ) : (
            <div className="p-6">
              <div className="grid gap-4">
                {diaries.map(diary => (
                  <Card
                    key={diary.date}
                    className="cursor-pointer hover:shadow-md transition-all"
                    onClick={() => handleDiaryClick(diary.date)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 mb-2">
                            <div className="flex items-center gap-2 text-lg font-semibold">
                              <Calendar className="h-5 w-5" />
                              <span>{dayjs(diary.date).format('M月D日 dddd')}</span>
                            </div>
                            {diary.moodKey && (
                              <Badge variant="outline" className="text-sm">
                                {MOOD_EMOJIS[diary.moodKey]?.emoji}{' '}
                                {MOOD_EMOJIS[diary.moodKey]?.label}
                              </Badge>
                            )}
                          </div>
                          {diary.summary && (
                            <p className="text-sm text-muted-foreground line-clamp-2">
                              {diary.summary}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          {dayjs(diary.updatedAt).format('HH:mm')}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 mt-8">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(page - 1)}
                    disabled={page <= 1}
                  >
                    上一页
                  </Button>
                  <div className="flex items-center gap-1">
                    {Array.from({ length: totalPages }, (_, i) => i + 1)
                      .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 2)
                      .map((pageNum, idx, arr) => {
                        const prevNum = arr[idx - 1]
                        if (prevNum && pageNum - prevNum > 1) {
                          return (
                            <span key={`ellipsis-${pageNum}`} className="text-muted-foreground">
                              ...
                            </span>
                          )
                        }
                        return (
                          <Button
                            key={pageNum}
                            variant={page === pageNum ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => handlePageChange(pageNum)}
                          >
                            {pageNum}
                          </Button>
                        )
                      })}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(page + 1)}
                    disabled={page >= totalPages}
                  >
                    下一页
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </DeskTopLayout>
  )
}
