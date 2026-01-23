import { useState, useEffect } from 'react'
import { apiClient } from '../lib/api-client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import type { Diary } from '../types/api'

export function DiaryList() {
  const [diaries, setDiaries] = useState<Diary[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadDiaries()
  }, [])

  const loadDiaries = async () => {
    try {
      const response = await apiClient.getDiaries({ page: 1, page_size: 100 })
      setDiaries(response.items)
    } catch (error: unknown) {
      console.error('加载日记失败', error)
      toast.error('加载日记失败')
    } finally {
      setLoading(false)
    }
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
    <div className="grid gap-4">
      {diaries.map(diary => (
        <Card key={diary.date}>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <CardTitle className="text-lg mb-2">{diary.date}</CardTitle>
                <CardDescription className="text-base mb-3">{diary.summary}</CardDescription>
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline">心情: {diary.mood_key}</Badge>
                  <Badge variant="secondary">评分: {diary.mood_score}/100</Badge>
                  <Badge variant="outline">{diary.memo_count} 条 memo</Badge>
                </div>
              </div>
            </div>
          </CardHeader>
        </Card>
      ))}
    </div>
  )
}
