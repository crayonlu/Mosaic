import { ArrowLeft, Bot, Camera, Loader, Plus, Trash2 } from 'lucide-react'
import type { FetchOptions } from 'ofetch'
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'
import AdminImage from '../components/AdminImage'
import { useToast } from '../hooks/useToast'

interface BotData {
  id: string
  name: string
  description: string
  autoReply: boolean
  tags: string[]
  avatarUrl: string
}

const emptyForm = {
  name: '',
  description: '',
  autoReply: true,
  tags: [] as string[],
  avatarUrl: '',
}

export default function Bots() {
  const toast = useToast()

  const [bots, setBots] = useState<BotData[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [avatarUploading, setAvatarUploading] = useState(false)
  const [editing, setEditing] = useState<BotData | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [tagInput, setTagInput] = useState('')

  const avatarRef = useRef<HTMLInputElement>(null)
  const autoReplyCount = bots.filter((b) => b.autoReply).length
  const showEditor = editing !== null || isCreating

  function clearEditor() {
    setEditing(null)
    setIsCreating(false)
    setForm(emptyForm)
    setTagInput('')
  }

  async function loadBots() {
    setLoading(true)
    try {
      setBots((await api('/bots')) as BotData[])
    } catch {
      setBots([])
    } finally {
      setLoading(false)
    }
  }

  function openEditor(bot?: BotData) {
    if (bot) {
      setEditing(bot)
      setIsCreating(false)
    } else {
      setEditing(null)
      setIsCreating(true)
    }
    setForm({
      name: bot?.name || '',
      description: bot?.description || '',
      autoReply: bot?.autoReply ?? true,
      tags: bot?.tags ? [...bot.tags] : [],
      avatarUrl: bot?.avatarUrl || '',
    })
    setTagInput('')
  }

  async function save() {
    if (!form.name.trim()) {
      toast.error('请输入名称')
      return
    }
    setSaving(true)
    try {
      const body = {
        name: form.name,
        description: form.description,
        autoReply: form.autoReply,
        tags: form.tags,
        avatarUrl: form.avatarUrl || undefined,
      }
      if (editing) {
        const updated = (await api(`/bots/${editing.id}`, { method: 'PUT', body })) as BotData
        toast.success('已更新')
        await loadBots()
        openEditor(updated)
      } else {
        await api('/bots', { method: 'POST', body })
        toast.success('已创建')
        await loadBots()
        clearEditor()
      }
    } catch {
      toast.error('操作失败')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(bot: BotData) {
    try {
      await api(`/bots/${bot.id}`, { method: 'DELETE' })
      toast.success('已删除')
      await loadBots()
      if (editing?.id === bot.id) clearEditor()
    } catch {
      toast.error('删除失败')
    }
  }

  function addTag() {
    const value = tagInput.trim()
    if (value && !form.tags.includes(value)) {
      setForm((f) => ({ ...f, tags: [...f.tags, value] }))
    }
    setTagInput('')
  }

  function onTagKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') { e.preventDefault(); addTag() }
    if (e.key === 'Backspace' && !tagInput && form.tags.length) {
      setForm((f) => ({ ...f, tags: f.tags.slice(0, -1) }))
    }
  }

  async function uploadAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setAvatarUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const options: FetchOptions = { method: 'POST', body: fd, headers: {} }
      const res = (await api('/resources', options)) as { url?: string; thumbnailUrl?: string }
      setForm((f) => ({ ...f, avatarUrl: res.url || res.thumbnailUrl || '' }))
      toast.success('头像已上传')
    } catch {
      toast.error('上传失败')
    } finally {
      setAvatarUploading(false)
      if (avatarRef.current) avatarRef.current.value = ''
    }
  }

  useEffect(() => {
    let active = true
    void api('/bots')
      .then((data) => { if (active) setBots(data as BotData[]) })
      .catch(() => { if (active) setBots([]) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  return (
    <div className="mx-auto max-w-300 py-5 sm:py-7">

      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-2">
          <Link
            to="/dashboard"
            className="inline-flex w-fit items-center gap-1.5 text-[13px] text-muted-foreground no-underline transition-colors hover:text-foreground"
          >
            <ArrowLeft size={14} />
            返回
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-[17px] font-semibold text-foreground">Bot 管理</h1>
            <span className="rounded-full border border-border bg-muted px-2.5 py-0.5 text-[11px] text-muted-foreground">
              {bots.length} 个 · {autoReplyCount} 自动
            </span>
          </div>
        </div>

        <button
          className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-[13px] font-medium text-primary-foreground transition-colors hover:bg-primary/90 sm:w-auto"
          onClick={() => openEditor()}
          type="button"
        >
          <Plus size={14} />
          新建 Bot
        </button>
      </div>

      <div className={`grid gap-4 ${showEditor ? 'lg:grid-cols-[300px_1fr]' : ''}`}>
        <div className="rounded-lg border border-border bg-card">
          {loading ? (
            <div className="p-4 space-y-2">
              <div className="skeleton h-14 rounded-lg" />
              <div className="skeleton h-14 rounded-lg" />
              <div className="skeleton h-14 rounded-lg" />
            </div>
          ) : bots.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
              <div className="flex size-12 items-center justify-center rounded-full bg-muted">
                <Bot size={22} className="text-muted-foreground" />
              </div>
              <div>
                <p className="text-[13px] font-medium text-foreground">还没有 Bot</p>
                <p className="mt-0.5 text-xs text-muted-foreground">点击右上角「新建 Bot」开始</p>
              </div>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {bots.map((bot) => {
                const isActive = editing?.id === bot.id
                return (
                  <div
                    key={bot.id}
                    className={`flex items-center gap-3 px-4 py-3 transition-colors ${isActive ? 'bg-accent' : 'hover:bg-muted/50'}`}
                  >
                    <button
                      className="flex min-w-0 flex-1 items-center gap-3 border-none bg-transparent p-0 text-left"
                      onClick={() => openEditor(bot)}
                      type="button"
                    >
                      <div className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-muted">
                        {bot.avatarUrl ? (
                          <AdminImage src={bot.avatarUrl} className="size-full object-cover" alt="" />
                        ) : (
                          <Bot size={15} className="text-muted-foreground" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-[13px] font-medium text-foreground">
                            {bot.name}
                          </span>
                          <span
                            className={`inline-flex shrink-0 rounded-full px-2 py-px text-[10px] font-medium ${bot.autoReply ? 'bg-success/10 text-success' : 'bg-muted-foreground/15 text-muted-foreground'}`}
                          >
                            {bot.autoReply ? '自动' : '手动'}
                          </span>
                        </div>
                        {bot.tags.length > 0 && (
                          <div className="mt-1 flex flex-wrap gap-1">
                            {bot.tags.slice(0, 4).map((tag) => (
                              <span key={tag} className="text-[11px] text-muted-foreground">
                                #{tag}
                              </span>
                            ))}
                            {bot.tags.length > 4 && (
                              <span className="text-[11px] text-muted-foreground">
                                +{bot.tags.length - 4}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </button>

                    <button
                      className="inline-flex shrink-0 items-center justify-center rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => handleDelete(bot)}
                      title="删除"
                      type="button"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {showEditor && (
          <div className="rounded-lg border border-border bg-card">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <h2 className="text-[13px] font-semibold text-foreground">
                {editing ? '编辑 Bot' : '新建 Bot'}
              </h2>
              <button
                className="text-xs text-muted-foreground transition-colors hover:text-foreground"
                onClick={clearEditor}
                type="button"
              >
                取消
              </button>
            </div>

            <div className="flex flex-col gap-5 p-4 sm:p-5">
              <div className="flex items-center gap-4">
                <div
                  className={`relative flex size-16 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-full border-2 border-border bg-muted transition-opacity ${avatarUploading ? 'opacity-60' : ''}`}
                  onClick={() => avatarRef.current?.click()}
                >
                  {form.avatarUrl ? (
                    <AdminImage src={form.avatarUrl} className="size-full object-cover" alt="" />
                  ) : (
                    <Bot size={24} className="text-muted-foreground" />
                  )}
                  <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/30 opacity-0 transition-opacity hover:opacity-100">
                    {avatarUploading
                      ? <Loader size={14} className="spin text-white" />
                      : <Camera size={14} className="text-white" />
                    }
                  </div>
                </div>
                <input ref={avatarRef} type="file" accept="image/*" className="sr-only" onChange={uploadAvatar} />

                <div className="flex-1 min-w-0">
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">
                    名称 <span className="text-destructive">*</span>
                  </label>
                  <input
                    className="h-9 w-full rounded-md border border-border bg-background px-3 text-[13px] text-foreground font-sans outline-none transition-colors focus:border-ring"
                    placeholder="Bot 名称"
                    maxLength={30}
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">简介</label>
                <textarea
                  className="w-full resize-y rounded-md border border-border bg-background px-3 py-2.5 text-[13px] text-foreground font-sans leading-relaxed outline-none transition-colors focus:border-ring"
                  placeholder="描述这个 Bot 的人设、职责或回复风格"
                  rows={10}
                  maxLength={1000}
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                />
                <div className="mt-1 text-right text-[11px] text-muted-foreground">
                  {form.description.length}/1000
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">标签</label>
                {form.tags.length > 0 && (
                  <div className="mb-2 flex flex-wrap gap-1.5">
                    {form.tags.map((tag) => (
                      <span
                        key={tag}
                        className="inline-flex items-center gap-1 rounded-full border border-border bg-muted px-2.5 py-0.5 text-[11px] text-foreground"
                      >
                        {tag}
                        <button
                          className="ml-0.5 text-muted-foreground hover:text-destructive"
                          onClick={() => setForm((f) => ({ ...f, tags: f.tags.filter((x) => x !== tag) }))}
                          type="button"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                <div className="flex gap-2">
                  <input
                    className="min-w-0 flex-1 rounded-md border border-border bg-background px-3 py-2 text-[13px] text-foreground font-sans outline-none transition-colors focus:border-ring"
                    placeholder="输入后回车添加"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={onTagKeyDown}
                  />
                  <button
                    className="shrink-0 rounded-md border border-border bg-muted px-3 py-2 text-xs font-medium text-foreground transition-colors hover:bg-muted/80"
                    onClick={addTag}
                    type="button"
                  >
                    添加
                  </button>
                </div>
              </div>

              <label className="flex cursor-pointer items-center gap-2.5">
                <div
                  role="switch"
                  aria-checked={form.autoReply}
                  onClick={() => setForm((f) => ({ ...f, autoReply: !f.autoReply }))}
                  className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border-2 border-transparent transition-colors ${form.autoReply ? 'bg-primary' : 'bg-muted-foreground/30'}`}
                >
                  <span
                    className={`inline-block size-4 rounded-full bg-white shadow-sm transition-transform ${form.autoReply ? 'translate-x-4' : 'translate-x-0'}`}
                  />
                </div>
                <div>
                  <span className="text-[13px] font-medium text-foreground">自动回复</span>
                  <p className="text-[11px] text-muted-foreground">创建 Memo 时自动触发该 Bot 回复</p>
                </div>
              </label>

              <button
                className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-primary py-2.5 text-[13px] font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
                disabled={saving || avatarUploading}
                onClick={save}
                type="button"
              >
                {saving ? <Loader size={14} className="spin" /> : (editing ? '保存更改' : '创建 Bot')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
