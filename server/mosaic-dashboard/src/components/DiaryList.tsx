import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import { Edit2, Eye } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { apiClient } from '../lib/api-client'
import type { Diary } from '../types/api'
import { moodLabels, moodColors, type MoodKey } from '../types/api'

export function DiaryList() {
  const [diaries, setDiaries] = useState<Diary[]>([])
  const [loading, setLoading] = useState(true)
  const [viewingDiary, setViewingDiary] = useState<Diary | null>(null)
  const [editingDiary, setEditingDiary] = useState<Diary | null>(null)
  const [editForm, setEditForm] = useState({
    summary: '',
    moodKey: 'neutral' as MoodKey,
    moodScore: 50,
  })

  useEffect(() => {
    loadDiaries()
  }, [])

  const loadDiaries = async () => {
    try {
      const response = await apiClient.getDiaries({ page: 1, pageSize: 100 })
      setDiaries(response.items)
    } catch (error: unknown) {
      console.error('加载日记失败', error)
      toast.error('加载日记失败')
    } finally {
      setLoading(false)
    }
  }

  const handleUpdate = async () => {
    if (!editingDiary) return

    try {
      const updated = await apiClient.updateDiary(editingDiary.date, {
        summary: editForm.summary,
        moodKey: editForm.moodKey,
        moodScore: editForm.moodScore,
      })
      setDiaries(diaries.map(d => (d.date === updated.date ? updated : d)))
      setEditingDiary(null)
      toast.success('日记更新成功')
    } catch (error: unknown) {
      console.error('更新日记失败', error)
      toast.error('更新日记失败')
    }
  }

  const openEditDialog = (diary: Diary) => {
    setEditingDiary(diary)
    setEditForm({
      summary: diary.summary,
      moodKey: (diary.moodKey as MoodKey) || 'neutral',
      moodScore: diary.moodScore || 50,
    })
  }

  if (loading) {
    return <div className="text-center py-8">加载中...</div>
  }

  if (diaries.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center py-8 text-stone-500">暂无日记</div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4">
        {diaries.map(diary => (
          <Card key={diary.date}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <CardTitle className="text-lg mb-2">{diary.date}</CardTitle>
                  <CardDescription className="text-base mb-3">
                    {diary.summary || '无摘要'}
                  </CardDescription>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge
                      variant="outline"
                      style={{
                        borderColor: moodColors[(diary.moodKey as MoodKey) || 'neutral'],
                        color: moodColors[(diary.moodKey as MoodKey) || 'neutral'],
                      }}
                    >
                      心情: {moodLabels[(diary.moodKey as MoodKey) || 'neutral']}
                    </Badge>
                    <Badge variant="secondary">评分: {diary.moodScore || 0}/100</Badge>
                    <Badge variant="outline">{diary.memoCount} 条 memo</Badge>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" onClick={() => setViewingDiary(diary)}>
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => openEditDialog(diary)}>
                    <Edit2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
          </Card>
        ))}
      </div>

      {/* 查看详情对话框 */}
      <Dialog open={viewingDiary !== null} onOpenChange={() => setViewingDiary(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{viewingDiary?.date}</DialogTitle>
            <DialogDescription>日记详情</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Badge
                variant="outline"
                style={{
                  borderColor: moodColors[(viewingDiary?.moodKey as MoodKey) || 'neutral'],
                  color: moodColors[(viewingDiary?.moodKey as MoodKey) || 'neutral'],
                }}
              >
                心情: {moodLabels[(viewingDiary?.moodKey as MoodKey) || 'neutral']}
              </Badge>
              <Badge variant="secondary">评分: {viewingDiary?.moodScore || 0}/100</Badge>
            </div>
            <div className="p-4 bg-stone-50 dark:bg-stone-900 rounded-lg">
              <p className="whitespace-pre-wrap">{viewingDiary?.summary || '无摘要'}</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* 编辑对话框 */}
      <Dialog open={editingDiary !== null} onOpenChange={() => setEditingDiary(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>编辑日记</DialogTitle>
            <DialogDescription>{editingDiary?.date}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="summary">摘要</Label>
              <textarea
                id="summary"
                className="flex min-h-25 w-full rounded-md border border-stone-200 bg-white px-3 py-2 text-sm ring-offset-white file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-stone-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-950 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:border-stone-800 dark:bg-stone-950 dark:ring-offset-stone-950 dark:placeholder:text-stone-400 dark:focus-visible:ring-stone-300"
                value={editForm.summary}
                onChange={e => setEditForm({ ...editForm, summary: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>心情</Label>
              <Select
                value={editForm.moodKey}
                onValueChange={(value: MoodKey) => setEditForm({ ...editForm, moodKey: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(moodLabels).map(([key, label]) => (
                    <SelectItem key={key} value={key}>
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: moodColors[key as MoodKey] }}
                        />
                        {label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>心情评分: {editForm.moodScore}</Label>
              <Slider
                value={[editForm.moodScore]}
                onValueChange={([value]) => setEditForm({ ...editForm, moodScore: value })}
                min={0}
                max={100}
                step={1}
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleUpdate}>保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
