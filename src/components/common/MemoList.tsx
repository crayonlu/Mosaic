import { memoCommands } from '@/utils/callRust'
import type { MemoWithResources } from '@/types/memo'
import { useEffect, useState } from 'react'
import { VoiceList } from '@/components/common/VoiceList'

interface MemoListProps {
  date: string
  className?: string
}

export function MemoList({ date, className }: MemoListProps) {
  const [memos, setMemos] = useState<MemoWithResources[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchMemos = async () => {
      try {
        setLoading(true)
        const data = await memoCommands.getMemosByDate(date)
        setMemos(data)
      } catch (error) {
        console.error('获取memos失败:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchMemos()
  }, [date])

  if (loading) {
    return (
      <div className={`${className} flex items-center justify-center py-4`}>
        <div className="text-sm text-muted-foreground">加载中...</div>
      </div>
    )
  }

  if (memos.length === 0) {
    return null
  }

  return (
    <div className={className}>
      <div className="space-y-2">
        {memos.map((memo) => (
          <div
            key={memo.id}
            className="rounded-lg border bg-card p-3 text-sm text-card-foreground shadow-sm"
          >
            <div className="whitespace-pre-wrap wrap-break-word">{memo.content}</div>
            {memo.resources && memo.resources.length > 0 && (
              <VoiceList
                resources={memo.resources}
                className="mt-3"
              />
            )}
            {memo.tags && (
              <div className="mt-2 flex flex-wrap gap-1">
                {memo.tags.split(',').map((tag, index) => (
                  <span
                    key={index}
                    className="rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground"
                  >
                    {tag.trim()}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

