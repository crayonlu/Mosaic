import { EmptyState } from '@/components/common/EmptyState'
import { MemoList, type MemoListRef } from '@/components/common/MemoList'
import DeskTopLayout from '@/components/layout/DeskTopLayout'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { LoadingSpinner } from '@/components/ui/loading/loading-spinner'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import { Textarea } from '@/components/ui/textarea'
import { toast } from '@/hooks/use-toast'
import type { DiaryWithMemos } from '@/types'
import { diaryCommands } from '@/utils/callRust'
import type { MoodKey } from '@/utils/mood'
import { MOODS } from '@/utils/mood'
import dayjs from 'dayjs'
import { ArrowLeft, BookOpen, Edit2, Loader2, Save, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

export default function DiaryDetailPage() {
  const { date } = useParams<{ date: string }>()
  const navigate = useNavigate()
  const [diary, setDiary] = useState<DiaryWithMemos | null>(null)
  const [loading, setLoading] = useState(true)
  const [editingSummary, setEditingSummary] = useState(false)
  const [editingMood, setEditingMood] = useState(false)
  const [summary, setSummary] = useState('')
  const [moodKey, setMoodKey] = useState<MoodKey>('neutral')
  const [moodScore, setMoodScore] = useState([5])
  const [saving, setSaving] = useState(false)
  const memoListRef = useRef<MemoListRef>(null)

  const fetchDiary = async () => {
    if (!date) return

    try {
      setLoading(true)
      const data = await diaryCommands.getDiaryByDate(date)
      setDiary(data)
      setSummary(data.summary || '')
      setMoodKey((data.moodKey ?? 'neutral') as MoodKey)
      setMoodScore([data.moodScore || 5])
    } catch (error) {
      console.error('获取日记详情失败:', error)
      toast.error('获取日记详情失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDiary()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date])

  const handleBack = () => {
    navigate('/diaries')
  }

  const handleSaveSummary = async () => {
    if (!date) return

    try {
      setSaving(true)
      await diaryCommands.updateDiarySummary({
        date,
        summary: summary.trim(),
      })
      await fetchDiary()
      setEditingSummary(false)
      toast.success('日记摘要已保存')
    } catch (error) {
      console.error('保存摘要失败:', error)
      toast.error('保存摘要失败')
    } finally {
      setSaving(false)
    }
  }

  const handleSaveMood = async () => {
    if (!diary || saving || !date) return

    try {
      setSaving(true)
      await diaryCommands.updateDiaryMood({
        date,
        moodKey: moodKey || 'neutral',
        moodScore: moodScore[0],
      })
      await fetchDiary()
      setEditingMood(false)
      toast.success('心情已保存')
    } catch (error) {
      console.error('保存心情失败:', error)
      toast.error('保存心情失败')
    } finally {
      setSaving(false)
    }
  }

  const handleCancelEdit = () => {
    if (diary) {
      setSummary(diary.summary || '')
      setMoodKey(diary.moodKey || '')
      setMoodScore([diary.moodScore || 5])
    }
    setEditingSummary(false)
    setEditingMood(false)
  }

  if (loading) {
    return (
      <DeskTopLayout className="relative">
        <div className="h-full flex items-center justify-center">
          <LoadingSpinner size="lg" />
        </div>
      </DeskTopLayout>
    )
  }

  if (!diary) {
    return (
      <DeskTopLayout className="relative">
        <div className="h-full flex items-center justify-center">
          <EmptyState icon={BookOpen} title="日记不存在" description="该日期没有日记记录" />
        </div>
      </DeskTopLayout>
    )
  }

  const dateDisplay = dayjs(diary.date).format('YYYY年M月D日 dddd')
  const moodOption = MOODS.find(m => m.key === diary.moodKey)

  return (
    <DeskTopLayout className="relative">
      <div className="h-full flex flex-col">
        <div className="border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60 sticky top-0 z-10">
          <div className="flex items-center justify-between px-6 pb-4 pt-2">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="sm" onClick={handleBack}>
                <ArrowLeft className="h-4 w-4 mr-1" />
                返回
              </Button>
              <div className="flex items-center gap-2">
                <BookOpen className="h-5 w-5" />
                <span className="text-lg font-semibold">{dateDisplay}</span>
              </div>
              {moodOption && (
                <Badge variant="outline" className="text-sm">
                  {moodOption.emoji} {moodOption.label} (强度: {diary.moodScore}/10)
                </Badge>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-6">
            <div className="max-w-3xl mx-auto space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>日记总结</span>
                    {!editingSummary && (
                      <Button variant="ghost" size="sm" onClick={() => setEditingSummary(true)}>
                        <Edit2 className="h-4 w-4 mr-1" />
                        编辑
                      </Button>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {editingSummary ? (
                    <div className="space-y-4">
                      <Textarea
                        value={summary}
                        onChange={e => setSummary(e.target.value)}
                        placeholder="写下今天的总结..."
                        rows={4}
                        disabled={saving}
                      />
                      <div className="flex justify-end">
                        <Button onClick={handleSaveSummary} disabled={saving}>
                          {saving ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin mr-2" />
                              保存中
                            </>
                          ) : (
                            <>
                              <Save className="h-4 w-4 mr-2" />
                              保存
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm whitespace-pre-wrap">{diary.summary || '暂无总结'}</p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>心情记录</span>
                    {!editingMood ? (
                      <Button variant="ghost" size="sm" onClick={() => setEditingMood(true)}>
                        <Edit2 className="h-4 w-4 mr-1" />
                        编辑
                      </Button>
                    ) : (
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={handleCancelEdit}
                          disabled={saving}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={handleSaveMood}
                          disabled={saving || !moodKey}
                        >
                          {saving ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Save className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {editingMood ? (
                    <div className="space-y-4">
                      <Select
                        value={moodKey}
                        onValueChange={(value: string) => setMoodKey(value as MoodKey)}
                        disabled={saving}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="选择心情" />
                        </SelectTrigger>
                        <SelectContent>
                          {MOODS.map(mood => (
                            <SelectItem key={mood.key} value={mood.key}>
                              <div className="flex items-center gap-2">
                                <span>{mood.emoji}</span>
                                <span>{mood.label}</span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <div className="flex items-center gap-4 mt-2">
                        <span className="text-sm font-medium">强度: {moodScore[0]}/10</span>
                        <Slider
                          value={[moodScore[0]]}
                          onValueChange={setMoodScore}
                          max={10}
                          min={1}
                          step={1}
                          disabled={saving}
                          className="flex-1"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-sm">
                        {moodOption?.emoji} {moodOption?.label} (强度: {diary.moodScore}/10)
                      </Badge>
                    </div>
                  )}
                </CardContent>
              </Card>

              <MemoList diaryDate={date} ref={memoListRef} onMemoClick={() => {}} />
            </div>
          </div>
        </div>
      </div>
    </DeskTopLayout>
  )
}
