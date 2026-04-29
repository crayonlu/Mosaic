import { Bot } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api'

interface BotData {
  id: string
  name: string
  description: string
  autoReply: boolean
  tags: string[]
  avatarUrl: string
}

export default function BotManager() {
  const navigate = useNavigate()

  const [bots, setBots] = useState<BotData[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let active = true

    void (async () => {
      setLoading(true)
      try {
        const data = (await api('/bots')) as BotData[]
        if (active) setBots(data)
      } catch {
        if (active) setBots([])
      } finally {
        if (active) setLoading(false)
      }
    })()

    return () => {
      active = false
    }
  }, [])

  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h3 className="flex items-center gap-1.5 text-[13px] font-semibold text-foreground">
          <Bot size={16} />
          Bot 概览
        </h3>
        <button className="border-none bg-transparent text-xs text-muted-foreground cursor-pointer hover:text-foreground transition-colors" onClick={() => navigate('/bots')}>进入管理页</button>
      </div>
      <div className="px-4 py-3">
        {loading && <div className="skeleton h-[80px]" />}
        {!loading && !bots.length && <div className="py-8 text-center text-sm text-muted-foreground">暂无 Bot</div>}
        {!loading && bots.length > 0 && (
          <div className="flex flex-col gap-1.5">
            {bots.slice(0, 4).map((b) => (
              <div key={b.id} className="flex items-center justify-between gap-2 rounded bg-muted px-2.5 py-2 text-[13px]">
                <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap font-medium">{b.name}</span>
                <span className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${b.autoReply ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning'}`}>
                  {b.autoReply ? '自动' : '手动'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
