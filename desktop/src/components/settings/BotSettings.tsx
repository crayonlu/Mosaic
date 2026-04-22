import { BotSheet } from '@/components/bot/BotSheet'
import { AuthImage } from '@/components/common/AuthImage'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { LoadingSkeleton } from '@/components/ui/loading/loading-skeleton'
import { toast } from '@/hooks/useToast'
import type { Bot } from '@mosaic/api'
import { useBots, useCreateBot, useDeleteBot, useUpdateBot } from '@mosaic/api'
import { Bot as BotIcon, Pencil, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'

export function BotSettings() {
  const { data: bots, isLoading } = useBots()
  const { mutateAsync: createBot, isPending: isCreating } = useCreateBot()
  const { mutateAsync: updateBot, isPending: isUpdating } = useUpdateBot()
  const { mutateAsync: deleteBot, isPending: isDeleting } = useDeleteBot()
  const [editingBot, setEditingBot] = useState<Bot | undefined>(undefined)
  const [isSheetOpen, setIsSheetOpen] = useState(false)
  const [deletingBot, setDeletingBot] = useState<Bot | null>(null)

  const isPending = isCreating || isUpdating || isDeleting

  const handleSave = async (data: {
    name: string
    description: string
    tags: string[]
    autoReply: boolean
    avatarUrl?: string
  }) => {
    try {
      if (editingBot) {
        await updateBot({ id: editingBot.id, data })
        toast.success('Bot 更新成功')
      } else {
        await createBot(data)
        toast.success('Bot 创建成功')
      }
      setIsSheetOpen(false)
      setEditingBot(undefined)
    } catch (err) {
      console.error(err)
      toast.error(editingBot ? '更新失败' : '创建失败')
    }
  }

  const handleDelete = async () => {
    if (!deletingBot) return
    try {
      await deleteBot(deletingBot.id)
      toast.success('Bot 删除成功')
      setDeletingBot(null)
    } catch (err) {
      console.error(err)
      toast.error('删除失败')
    }
  }

  const openCreate = () => {
    setEditingBot(undefined)
    setIsSheetOpen(true)
  }

  const openEdit = (bot: Bot) => {
    setEditingBot(bot)
    setIsSheetOpen(true)
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Bot 伴侣</CardTitle>
          <CardDescription>管理你的 AI Bot 伴侣</CardDescription>
        </CardHeader>
        <CardContent>
          <LoadingSkeleton lines={3} />
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BotIcon className="h-5 w-5" />
              <CardTitle>Bot 伴侣</CardTitle>
            </div>
            <Button size="sm" onClick={openCreate}>
              <Plus className="h-4 w-4 mr-1" />
              新建 Bot
            </Button>
          </div>
          <CardDescription>管理你的 AI Bot 伴侣，它们会在你记录 Memo 后自动评论</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {bots && bots.length > 0 ? (
            <div className="space-y-2">
              {bots.map(bot => (
                <div
                  key={bot.id}
                  className="flex items-center justify-between rounded-lg border p-3 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="h-10 w-10 rounded-full bg-muted shrink-0 overflow-hidden">
                      {bot.avatarUrl ? (
                        <AuthImage
                          src={bot.avatarUrl}
                          alt={bot.name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="h-full w-full rounded-full bg-primary text-primary-foreground text-sm flex items-center justify-center">
                          {bot.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium truncate">{bot.name}</span>
                        {bot.autoReply && (
                          <span className="inline-flex items-center rounded-full bg-primary/10 text-primary px-2 py-0.5 text-xs">
                            自动回复
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground truncate">{bot.description}</p>
                      {bot.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {bot.tags.map(tag => (
                            <span
                              key={tag}
                              className="inline-flex items-center rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 ml-2 shrink-0">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(bot)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setDeletingBot(bot)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-6 text-muted-foreground text-sm">
              还没有 Bot，点击右上角创建一个吧
            </div>
          )}
        </CardContent>
      </Card>

      <BotSheet
        bot={editingBot}
        open={isSheetOpen}
        onClose={() => {
          setIsSheetOpen(false)
          setEditingBot(undefined)
        }}
        onSave={handleSave}
        isPending={isPending}
      />

      <Dialog open={!!deletingBot} onOpenChange={open => !open && setDeletingBot(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>删除 Bot</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            确定要删除 <span className="font-medium text-foreground">{deletingBot?.name}</span>{' '}
            吗？此操作不可撤销。
          </p>
          <DialogFooter className="mt-4 flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setDeletingBot(null)}>
              取消
            </Button>
            <Button variant="destructive" size="sm" onClick={handleDelete} disabled={isDeleting}>
              {isDeleting ? '删除中...' : '删除'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
