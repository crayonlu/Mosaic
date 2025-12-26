import { useState, useEffect, useMemo } from 'react'
import dayjs from 'dayjs'
import { Calendar, Archive, Trash2, CheckSquare, Square } from 'lucide-react'
import DeskTopLayout from '@/components/layout/DeskTopLayout'
import { Button } from '@/components/ui/button'
import { Calendar as CalendarComponent } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Separator } from '@/components/ui/separator'
import { MemoCard } from '@/components/archive/MemoCard'
import { ArchiveDialog } from '@/components/archive/ArchiveDialog'
import { MemoDetail } from '@/components/common/MemoDetail'
import { LoadingMemoList } from '@/components/ui/loading/loading-skeleton'
import { EmptyState } from '@/components/common/EmptyState'
import { memoCommands, diaryCommands } from '@/utils/callRust'
import { toast } from '@/hooks/use-toast'
import type { MemoWithResources } from '@/types/memo'

type Mode = 'view' | 'select'

export default function ArchivePage() {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date())
  const [memos, setMemos] = useState<MemoWithResources[]>([])
  const [loading, setLoading] = useState(true)
  const [mode, setMode] = useState<Mode>('view')
  const [selectedMemos, setSelectedMemos] = useState<Set<string>>(new Set())
  const [isArchiveDialogOpen, setIsArchiveDialogOpen] = useState(false)
  const [isArchiving, setIsArchiving] = useState(false)
  const [selectedMemo, setSelectedMemo] = useState<MemoWithResources | null>(null)
  const [isDetailOpen, setIsDetailOpen] = useState(false)
  const [existingDiary, setExistingDiary] = useState<any>(null)

  const formattedDate = dayjs(selectedDate).format('YYYY-MM-DD')
  const dateDisplay = dayjs(selectedDate).format('M月D日 dddd')

  const fetchMemos = async () => {
    try {
      setLoading(true)
      const [memosData, diaryData] = await Promise.all([
        memoCommands.getMemosByDate(formattedDate),
        diaryCommands.getDiaryByDate(formattedDate).catch(() => null),
      ])
      setMemos(memosData.filter(memo => !memo.isDeleted))
      setExistingDiary(diaryData)
    } catch (error) {
      console.error('获取数据失败:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchMemos()
    setSelectedMemos(new Set())
    setMode('view')
    setExistingDiary(null)
  }, [formattedDate])

  const groupedMemos = useMemo(() => {
    const groups: Record<string, MemoWithResources[]> = {}

    memos.forEach(memo => {
      const hour = dayjs.utc(memo.createdAt).local().format('HH')
      const hourLabel = `${hour}:00-${parseInt(hour) + 1}:00`
      if (!groups[hourLabel]) {
        groups[hourLabel] = []
      }
      groups[hourLabel].push(memo)
    })

    return Object.entries(groups).sort(([a], [b]) => b.localeCompare(a))
  }, [memos])

  const handleModeToggle = () => {
    setMode(mode === 'view' ? 'select' : 'view')
    setSelectedMemos(new Set())
  }

  const handleMemoSelect = (memoId: string, selected: boolean) => {
    // 查找对应的memo，检查是否已归档
    const memo = memos.find(m => m.id === memoId)
    if (memo?.isArchived) return // 已归档的memo不能选择

    const newSelected = new Set(selectedMemos)
    if (selected) {
      newSelected.add(memoId)
    } else {
      newSelected.delete(memoId)
    }
    setSelectedMemos(newSelected)
  }

  const handleSelectAll = () => {
    const unarchivedMemos = memos.filter(m => !m.isArchived)
    const selectedUnarchivedCount = Array.from(selectedMemos).filter(id =>
      memos.find(m => m.id === id && !m.isArchived)
    ).length

    if (selectedUnarchivedCount === unarchivedMemos.length) {
      // 如果所有未归档的memo都已选中，则取消全选
      setSelectedMemos(new Set())
    } else {
      // 选择所有未归档的memo
      const newSelected = new Set(selectedMemos)
      unarchivedMemos.forEach(memo => {
        newSelected.add(memo.id)
      })
      setSelectedMemos(newSelected)
    }
  }

  const handleDeleteSelected = async () => {
    if (selectedMemos.size === 0) return

    try {
      const promises = Array.from(selectedMemos).map(id => memoCommands.deleteMemo(id))
      await Promise.all(promises)
      await fetchMemos()
      setSelectedMemos(new Set())
      setMode('view')
      toast.success(`成功删除 ${selectedMemos.size} 条记录`)
    } catch (error) {
      console.error('批量删除失败:', error)
      toast.error('批量删除失败')
    }
  }

  const handleArchiveSelected = () => {
    if (selectedMemos.size === 0) return
    setIsArchiveDialogOpen(true)
  }

  const handleArchiveConfirm = async (summary?: string, moodKey?: string, moodScore?: number) => {
    if (selectedMemos.size === 0) return

    try {
      setIsArchiving(true)

      await diaryCommands.createOrUpdateDiary({
        date: formattedDate,
        summary,
        moodKey: moodKey as any,
        moodScore,
      })

      const promises = Array.from(selectedMemos).map(id => memoCommands.archiveMemo(id))
      await Promise.all(promises)

      await fetchMemos()
      setSelectedMemos(new Set())
      setMode('view')
      setIsArchiveDialogOpen(false)
      toast.success(`成功归档 ${selectedMemos.size} 条记录`)
    } catch (error) {
      console.error('归档失败:', error)
      toast.error('归档失败')
    } finally {
      setIsArchiving(false)
    }
  }

  const handleMemoClick = (memo: MemoWithResources) => {
    setSelectedMemo(memo)
    setIsDetailOpen(true)
  }

  const handleDetailClose = () => {
    setIsDetailOpen(false)
    setTimeout(() => setSelectedMemo(null), 300)
  }

  const handleMemoUpdate = async () => {
    await fetchMemos()
    if (selectedMemo) {
      const updatedMemo = await memoCommands.getMemo(selectedMemo.id)
      setSelectedMemo(updatedMemo)
    }
  }

  const handleMemoDelete = async () => {
    await fetchMemos()
    setIsDetailOpen(false)
    setTimeout(() => setSelectedMemo(null), 300)
  }

  const handleUnarchiveMemo = async (memoId: string) => {
    try {
      await memoCommands.unarchiveMemo(memoId)
      await fetchMemos()
    } catch (error) {
      console.error('取消归档失败:', error)
    }
  }

  return (
    <DeskTopLayout className="relative">
      <div className="h-full flex flex-col">
        <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-10">
          <div className="flex items-center justify-between px-6 pb-4 pt-2">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Archive className="h-5 w-5" />
                <span className="text-lg font-semibold">归档</span>
              </div>

              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2">
                    <Calendar className="h-4 w-4" />
                    {dateDisplay}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarComponent
                    mode="single"
                    selected={selectedDate}
                    onSelect={date => date && setSelectedDate(date)}
                    initialFocus
                    className="rounded-md border-0"
                  />
                </PopoverContent>
              </Popover>

              <Badge variant="secondary" className="text-xs">
                {memos.length} 条memo
              </Badge>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant={mode === 'select' ? 'default' : 'outline'}
                size="sm"
                onClick={handleModeToggle}
                className="gap-2"
              >
                {mode === 'select' ? (
                  <>
                    <Square className="h-4 w-4" />
                    选择模式
                  </>
                ) : (
                  <>
                    <CheckSquare className="h-4 w-4" />
                    选择模式
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <LoadingMemoList count={2} />
          ) : memos.length === 0 ? (
            <EmptyState
              icon={Archive}
              title="暂无memo"
              description={
                dayjs(selectedDate).isSame(dayjs(), 'day')
                  ? '今天还没有创建memo'
                  : `${dateDisplay}没有memo记录`
              }
            />
          ) : (
            <div className="p-6 space-y-8">
              {groupedMemos.map(([timeRange, timeMemos]) => (
                <div key={timeRange}>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="text-sm font-medium text-muted-foreground">{timeRange}</div>
                    <Separator className="flex-1" />
                    <Badge variant="outline" className="text-xs">
                      {timeMemos.length} 条
                    </Badge>
                  </div>

                  <div className="space-y-3">
                    {timeMemos.map(memo => (
                      <MemoCard
                        key={memo.id}
                        memo={memo}
                        mode={mode}
                        selected={selectedMemos.has(memo.id)}
                        onSelect={handleMemoSelect}
                        onUnarchive={handleUnarchiveMemo}
                        onClick={() => {
                          if (mode === 'view') {
                            handleMemoClick(memo)
                          }
                        }}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {mode === 'select' && memos.length > 0 && (
          <div className="border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky bottom-0 z-10">
            <div className="flex items-center justify-between px-6 pt-4 pb-2">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={
                      selectedMemos.size === memos.filter(m => !m.isArchived).length &&
                      memos.filter(m => !m.isArchived).length > 0
                    }
                    onCheckedChange={handleSelectAll}
                  />
                  <span className="text-sm font-medium">
                    全选 ({selectedMemos.size}/{memos.filter(m => !m.isArchived).length})
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setMode('view')}
                  className="text-muted-foreground"
                >
                  取消
                </Button>

                {selectedMemos.size > 0 && (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleDeleteSelected}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4 mr-1" />
                      删除 ({selectedMemos.size})
                    </Button>

                    <Button
                      variant="default"
                      size="sm"
                      onClick={handleArchiveSelected}
                      className="gap-2"
                    >
                      <Archive className="h-4 w-4" />
                      归档 ({selectedMemos.size})
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        <ArchiveDialog
          open={isArchiveDialogOpen}
          onClose={() => setIsArchiveDialogOpen(false)}
          selectedCount={selectedMemos.size}
          date={formattedDate}
          existingDiary={existingDiary}
          onConfirm={handleArchiveConfirm}
          isLoading={isArchiving}
        />

        <MemoDetail
          memo={selectedMemo}
          open={isDetailOpen}
          onClose={handleDetailClose}
          onUpdate={handleMemoUpdate}
          onDelete={handleMemoDelete}
        />
      </div>
    </DeskTopLayout>
  )
}
