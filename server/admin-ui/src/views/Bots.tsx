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
  const [form, setForm] = useState(emptyForm)
  const [tagInput, setTagInput] = useState('')

  const avatarRef = useRef<HTMLInputElement>(null)
  const autoReplyCount = bots.filter((bot) => bot.autoReply).length

  function clearEditor() {
    setEditing(null)
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
    setEditing(bot || null)
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
      if (editing?.id === bot.id) {
        clearEditor()
      }
    } catch {
      toast.error('删除失败')
    }
  }

  function addTag() {
    const value = tagInput.trim()
    if (value && !form.tags.includes(value)) {
      setForm((current) => ({ ...current, tags: [...current.tags, value] }))
    }
    setTagInput('')
  }

  function onTagBackspace() {
    if (!tagInput && form.tags.length) {
      setForm((current) => ({ ...current, tags: current.tags.slice(0, -1) }))
    }
  }

  function triggerAvatar() {
    avatarRef.current?.click()
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
      setForm((current) => ({ ...current, avatarUrl: res.url || res.thumbnailUrl || '' }))
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
      .then((data) => {
        if (active) {
          setBots(data as BotData[])
        }
      })
      .catch(() => {
        if (active) {
          setBots([])
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false)
        }
      })

    return () => {
      active = false
    }
  }, [])

  return (
    <div className="mx-auto max-w-300 pt-3">
      <div className="mb-4 rounded-2xl border border-border/70 bg-card/80 px-4 py-4 shadow-sm backdrop-blur-sm sm:px-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <Link to="/dashboard" className="inline-flex items-center gap-1 rounded-md border border-border/70 bg-background/60 px-2.5 py-1.5 text-xs text-muted-foreground no-underline transition-colors hover:border-border hover:text-foreground">
                <ArrowLeft size={14} />
                返回
              </Link>
            </div>
            <div>
              <h2 className="text-[15px] font-semibold text-foreground sm:text-[17px]">Bot 管理</h2>
              <p className="mt-1 text-xs text-muted-foreground">轻量编辑，直接管理头像、标签和回复方式。</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/60 px-3 py-1.5 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">{bots.length}</span>
              <span>总数</span>
            </div>
            <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/60 px-3 py-1.5 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">{autoReplyCount}</span>
              <span>自动回复</span>
            </div>
            <button
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/80 sm:w-auto"
              onClick={() => openEditor()}
              type="button"
            >
              <Plus size={15} />
              新建
            </button>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.05fr)_420px]">
        <div className="rounded-2xl border border-border/70 bg-card/80 shadow-sm">
          <div className="flex items-center justify-between border-b border-border/70 px-4 py-3 sm:px-5">
            <div className="flex items-center gap-2">
              <Bot size={16} className="text-muted-foreground" />
              <h3 className="text-[13px] font-semibold text-foreground">列表</h3>
            </div>
            <span className="text-xs text-muted-foreground">{loading ? '加载中' : `${bots.length} 条`}</span>
          </div>

          <div className="p-3 sm:p-4">
            {loading && <div className="skeleton h-30 rounded-xl" />}
            {!loading && !bots.length && <div className="py-10 text-center text-sm text-muted-foreground">暂无 Bot</div>}
            {!loading && bots.length > 0 && (
              <div className="flex flex-col gap-2">
                {bots.map((bot) => {
                  const isEditing = editing?.id === bot.id

                  return (
                    <div
                      key={bot.id}
                      className={`rounded-xl border px-3 py-3 transition-colors ${isEditing ? 'border-ring/70 bg-muted/70' : 'border-border/70 bg-background/40 hover:border-border hover:bg-muted/40'}`}
                    >
                      <div className="flex items-center gap-3">
                        <button className="flex min-w-0 flex-1 items-center gap-3 border-none bg-transparent p-0 text-left cursor-pointer" onClick={() => openEditor(bot)} type="button">
                          <div className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border/70 bg-secondary/70">
                            {bot.avatarUrl ? (
                              <AdminImage src={bot.avatarUrl} className="size-full object-cover" alt="" />
                            ) : (
                              <Bot size={18} className="text-muted-foreground" />
                            )}
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="truncate text-[13px] font-medium text-foreground">{bot.name}</span>
                              <span className={`inline-flex shrink-0 rounded-full px-2 py-px text-[10px] font-medium ${bot.autoReply ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning'}`}>
                                {bot.autoReply ? '自动' : '手动'}
                              </span>
                            </div>
                            {bot.tags.length > 0 && (
                              <div className="mt-2 flex flex-wrap gap-1">
                                {bot.tags.slice(0, 3).map((tag) => (
                                  <span key={tag} className="inline-flex rounded-full border border-border/70 bg-background/70 px-2 py-0.5 text-[10px] text-muted-foreground">
                                    {tag}
                                  </span>
                                ))}
                                {bot.tags.length > 3 && <span className="text-[10px] text-muted-foreground">+{bot.tags.length - 3}</span>}
                              </div>
                            )}
                          </div>
                        </button>

                        <button
                          className="inline-flex shrink-0 items-center justify-center rounded-full border border-transparent bg-transparent p-2 text-muted-foreground transition-colors hover:border-destructive/20 hover:bg-destructive/10 hover:text-destructive"
                          onClick={() => handleDelete(bot)}
                          title="删除"
                          type="button"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-border/70 bg-card/80 shadow-sm">
          <div className="flex items-center justify-between border-b border-border/70 px-4 py-3 sm:px-5">
            <div className="flex min-w-0 items-center gap-2">
              <h3 className="truncate text-[13px] font-semibold text-foreground">{editing ? '编辑 Bot' : '新建 Bot'}</h3>
              {editing && <span className="rounded-full bg-muted px-2 py-px text-[10px] text-muted-foreground">已选中</span>}
            </div>
            {editing && (
              <button className="border-none bg-transparent text-xs text-muted-foreground transition-colors hover:text-foreground" onClick={clearEditor} type="button">
                清空
              </button>
            )}
          </div>

          <div className="flex flex-col gap-4 p-4 sm:p-5">
            <div className="flex flex-col gap-4 rounded-xl border border-border/70 bg-background/40 p-4 sm:flex-row sm:items-start">
              <div className="flex shrink-0 flex-col items-center gap-1.5">
                <div
                  className={`relative flex size-18 cursor-pointer items-center justify-center overflow-hidden rounded-full border border-border/70 bg-secondary/70 ${avatarUploading ? 'opacity-70' : ''}`}
                  onClick={triggerAvatar}
                >
                  {form.avatarUrl ? (
                    <AdminImage src={form.avatarUrl} className="size-full object-cover" alt="Bot avatar" />
                  ) : (
                    <div className="flex size-full items-center justify-center text-muted-foreground">
                      <Bot size={30} />
                    </div>
                  )}
                  <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/20 opacity-0 transition-opacity hover:opacity-100">
                    {avatarUploading ? <Loader size={18} className="spin text-white" /> : <Camera size={18} className="text-white" />}
                  </div>
                </div>
                <input ref={avatarRef} type="file" accept="image/*" className="sr-only" onChange={uploadAvatar} />
              </div>

              <div className="min-w-0 flex-1 space-y-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">
                    名称 <span className="text-destructive">*</span>
                  </label>
                  <input
                    className="h-10 w-full rounded-md border border-border/70 bg-card px-3 text-sm text-foreground font-sans outline-none transition-colors focus:border-ring"
                    placeholder="Bot 名称"
                    maxLength={30}
                    value={form.name}
                    onChange={(e) => setForm((current) => ({ ...current, name: e.target.value }))}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">简介</label>
                  <textarea
                    className="min-h-30 w-full resize-y rounded-md border border-border/70 bg-card px-3 py-2 text-sm text-foreground font-sans leading-relaxed outline-none transition-colors focus:border-ring"
                    placeholder="简短描述"
                    rows={6}
                    maxLength={1000}
                    value={form.description}
                    onChange={(e) => setForm((current) => ({ ...current, description: e.target.value }))}
                  />
                  <div className="text-right text-[11px] text-muted-foreground">{form.description.length}/1000</div>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">标签</label>
              <div className="flex flex-wrap gap-1.5">
                {form.tags.map((tag) => (
                  <span key={tag} className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-muted/60 px-2.5 py-1 text-[11px] text-foreground">
                    {tag}
                    <button
                      className="border-none bg-transparent p-0 text-[10px] text-muted-foreground cursor-pointer hover:text-destructive"
                      onClick={() => setForm((current) => ({ ...current, tags: current.tags.filter((x) => x !== tag) }))}
                      type="button"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  className="min-w-0 flex-1 rounded-md border border-border/70 bg-card px-3 py-2 text-sm text-foreground font-sans outline-none transition-colors focus:border-ring"
                  placeholder="输入后回车"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      addTag()
                    }
                    if (e.key === 'Backspace') onTagBackspace()
                  }}
                />
                <button className="inline-flex w-full shrink-0 items-center justify-center rounded-md border border-border/70 bg-secondary/70 px-3 py-2 text-xs font-medium text-secondary-foreground transition-colors cursor-pointer hover:bg-secondary sm:w-auto" onClick={addTag} type="button">
                  添加
                </button>
              </div>
            </div>

            <label className="flex items-center gap-2 text-[13px] text-foreground cursor-pointer">
              <input
                type="checkbox"
                className="size-4 accent-primary"
                checked={form.autoReply}
                onChange={(e) => setForm((current) => ({ ...current, autoReply: e.target.checked }))}
              />
              自动回复
            </label>

            <button
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-full bg-primary px-4 py-2.5 text-[13px] font-medium text-primary-foreground transition-colors cursor-pointer hover:bg-primary/80 disabled:opacity-50"
              disabled={saving || avatarUploading}
              onClick={save}
              type="button"
            >
              {saving ? <Loader size={14} className="spin" /> : <span>保存</span>}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
