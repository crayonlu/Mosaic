import { Camera, PencilSimple, Plus, Robot, Trash } from "@phosphor-icons/react"
import type { FetchOptions } from "ofetch"
import { useCallback, useRef, useState, type ChangeEvent } from "react"
import { useTranslation } from "react-i18next"
import { api, type BotData } from "../../api"
import AuthImage from "../../components/AuthImage"
import { Badge } from "../../components/ui/badge"
import { Button } from "../../components/ui/button"
import { ConfirmDialog } from "../../components/ui/confirm-dialog"
import { EmptyState } from "../../components/ui/empty-state"
import { ErrorState } from "../../components/ui/error-state"
import { Field } from "../../components/ui/field"
import { Input } from "../../components/ui/input"
import { Modal } from "../../components/ui/dialog"
import { PageHeader } from "../../components/ui/page-header"
import { Skeleton } from "../../components/ui/skeleton"
import { AppSwitch } from "../../components/ui/switch"
import { TagInput } from "../../components/ui/tag-input"
import { Textarea } from "../../components/ui/textarea"
import { AppTooltip } from "../../components/ui/tooltip"
import { useAsyncData } from "../../hooks/useAsyncData"
import { useToast } from "../../hooks/useToast"
import { cn } from "../../lib/utils"

interface BotForm {
  name: string
  description: string
  autoReply: boolean
  tags: string[]
  avatarUrl: string
  model: string
}

const emptyForm: BotForm = {
  name: "",
  description: "",
  autoReply: true,
  tags: [],
  avatarUrl: "",
  model: "",
}

function formFromBot(bot?: BotData | null): BotForm {
  return {
    name: bot?.name ?? "",
    description: bot?.description ?? "",
    autoReply: bot?.autoReply ?? true,
    tags: bot?.tags ? [...bot.tags] : [],
    avatarUrl: bot?.avatarUrl ?? "",
    model: bot?.model ?? "",
  }
}

export default function BotsView() {
  const { t } = useTranslation()
  const toast = useToast()

  const bots = useAsyncData<BotData[]>(
    useCallback(() => api("/bots") as Promise<BotData[]>, [])
  )

  const [editorOpen, setEditorOpen] = useState(false)
  const [editingBot, setEditingBot] = useState<BotData | null>(null)
  const [form, setForm] = useState<BotForm>(emptyForm)
  const [originalForm, setOriginalForm] = useState<BotForm>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [avatarUploading, setAvatarUploading] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<BotData | null>(null)
  const [discardOpen, setDiscardOpen] = useState(false)

  const avatarRef = useRef<HTMLInputElement>(null)
  const dirty = JSON.stringify(form) !== JSON.stringify(originalForm)

  function openEditor(bot?: BotData | null) {
    const next = formFromBot(bot)
    setEditingBot(bot ?? null)
    setForm(next)
    setOriginalForm(next)
    setEditorOpen(true)
  }

  function requestClose() {
    if (dirty) {
      setDiscardOpen(true)
      return
    }
    setEditorOpen(false)
  }

  function handleDiscard() {
    setDiscardOpen(false)
    setEditorOpen(false)
  }

  async function save() {
    if (!form.name.trim()) {
      toast.error(t("bots.nameRequired"))
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
        model: form.model || undefined,
      }
      if (editingBot) {
        const updated = (await api(`/bots/${editingBot.id}`, {
          method: "PUT",
          body,
        })) as BotData
        toast.success(t("bots.updated"))
        await bots.refetch()
        setEditingBot(updated)
        setForm(formFromBot(updated))
        setOriginalForm(formFromBot(updated))
      } else {
        await api("/bots", { method: "POST", body })
        toast.success(t("bots.created"))
        await bots.refetch()
        setEditorOpen(false)
      }
    } catch {
      toast.error(t("bots.operationFailed"))
    } finally {
      setSaving(false)
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    try {
      await api(`/bots/${deleteTarget.id}`, { method: "DELETE" })
      toast.success(t("bots.deleted"))
      if (editingBot?.id === deleteTarget.id) setEditorOpen(false)
      setDeleteTarget(null)
      await bots.refetch()
    } catch {
      toast.error(t("bots.deleteFailed"))
    }
  }

  async function uploadAvatar(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setAvatarUploading(true)
    try {
      const fd = new FormData()
      fd.append("file", file)
      const options: FetchOptions = { method: "POST", body: fd, headers: {} }
      const res = (await api("/resources", options)) as {
        url?: string
        thumbnailUrl?: string
      }
      setForm((f) => ({ ...f, avatarUrl: res.url || res.thumbnailUrl || "" }))
      toast.success(t("bots.avatarUploaded"))
    } catch {
      toast.error(t("bots.uploadFailed"))
    } finally {
      setAvatarUploading(false)
      if (avatarRef.current) avatarRef.current.value = ""
    }
  }

  const autoReplyCount = (bots.data ?? []).filter((b) => b.autoReply).length

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("bots.title")}
        actions={
          <>
            <span className="hidden items-center sm:flex">
              <Badge variant="neutral">
                {t("bots.count", {
                  count: bots.data?.length ?? 0,
                  auto: autoReplyCount,
                })}
              </Badge>
            </span>
            <Button onClick={() => openEditor(null)}>
              <Plus size={14} />
              {t("bots.newBot")}
            </Button>
          </>
        }
      />

      {bots.loading && !bots.data ? (
        <div className="space-y-2">
          <Skeleton className="h-12" />
          <Skeleton className="h-12" />
          <Skeleton className="h-12" />
        </div>
      ) : bots.error ? (
        <ErrorState message={bots.error} onRetry={bots.refetch} />
      ) : !bots.data || bots.data.length === 0 ? (
        <EmptyState
          icon={<Robot size={18} />}
          title={t("bots.empty")}
          description={t("bots.emptyHint")}
          action={
            <Button size="sm" onClick={() => openEditor(null)}>
              <Plus size={13} />
              {t("bots.newBot")}
            </Button>
          }
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse">
            <thead>
              <tr className="border-b border-hairline text-left">
                <th className="px-3 py-2.5 text-xs font-medium text-ink-tertiary">
                  {t("bots.name")}
                </th>
                <th className="px-3 py-2.5 text-xs font-medium text-ink-tertiary">
                  {t("bots.autoReply")}
                </th>
                <th className="px-3 py-2.5 text-xs font-medium text-ink-tertiary">
                  {t("bots.tags")}
                </th>
                <th className="px-3 py-2.5 text-xs font-medium text-ink-tertiary">
                  {t("bots.model")}
                </th>
                <th className="px-3 py-2.5 text-right text-xs font-medium text-ink-tertiary">
                  {t("users.actions")}
                </th>
              </tr>
            </thead>
            <tbody>
              {bots.data.map((bot) => (
                <tr
                  key={bot.id}
                  className="border-b border-hairline transition-colors last:border-0 hover:bg-subtle/60"
                >
                  <td className="px-3 py-2.5">
                    <button
                      type="button"
                      onClick={() => openEditor(bot)}
                      className="flex items-center gap-2.5 text-left"
                    >
                      <div className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-subtle text-ink-tertiary">
                        {bot.avatarUrl ? (
                          <AuthImage
                            src={bot.avatarUrl}
                            className="size-full object-cover"
                            alt=""
                          />
                        ) : (
                          <Robot size={14} />
                        )}
                      </div>
                      <span className="text-[13px] font-medium text-ink">
                        {bot.name}
                      </span>
                    </button>
                  </td>
                  <td className="px-3 py-2.5">
                    <Badge variant={bot.autoReply ? "success" : "neutral"}>
                      {bot.autoReply ? t("bots.auto") : t("bots.manual")}
                    </Badge>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex flex-wrap gap-x-2 gap-y-0.5">
                      {bot.tags.length === 0 ? (
                        <span className="text-ink-tertiary">—</span>
                      ) : (
                        bot.tags.slice(0, 3).map((tag) => (
                          <span key={tag} className="text-xs text-ink-tertiary">
                            #{tag}
                          </span>
                        ))
                      )}
                      {bot.tags.length > 3 && (
                        <span className="text-xs text-ink-tertiary">
                          +{bot.tags.length - 3}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="font-mono text-xs text-ink-secondary">
                      {bot.model || "—"}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center justify-end gap-1">
                      <AppTooltip content={t("bots.editBot")}>
                        <button
                          type="button"
                          onClick={() => openEditor(bot)}
                          aria-label={t("bots.editBot")}
                          className="flex size-[40px] items-center justify-center rounded-md text-ink-tertiary transition-colors hover:bg-subtle hover:text-ink md:size-8"
                        >
                          <PencilSimple size={14} />
                        </button>
                      </AppTooltip>
                      <AppTooltip content={t("bots.delete")}>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(bot)}
                          aria-label={t("bots.delete")}
                          className="flex size-[40px] items-center justify-center rounded-md text-ink-tertiary transition-colors hover:bg-error/10 hover:text-error md:size-8"
                        >
                          <Trash size={14} />
                        </button>
                      </AppTooltip>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={editorOpen}
        onClose={requestClose}
        title={editingBot ? t("bots.editBot") : t("bots.newBot")}
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={requestClose} disabled={saving}>
              {t("bots.cancel")}
            </Button>
            <Button
              disabled={saving || avatarUploading}
              onClick={() => void save()}
            >
              {saving
                ? t("common.saving")
                : editingBot
                  ? t("bots.saveChanges")
                  : t("bots.createBot")}
            </Button>
          </>
        }
      >
        <div className="space-y-5">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => avatarRef.current?.click()}
              disabled={avatarUploading}
              className={cn(
                "group relative flex size-16 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-full bg-subtle text-ink-tertiary transition-opacity",
                "disabled:opacity-60"
              )}
              aria-label="Upload avatar"
            >
              {form.avatarUrl ? (
                <AuthImage
                  src={form.avatarUrl}
                  className="size-full object-cover"
                  alt=""
                />
              ) : (
                <Robot size={24} />
              )}
              <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/30 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                <Camera size={15} className="text-white" />
              </span>
            </button>
            <input
              ref={avatarRef}
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={uploadAvatar}
            />
            <Field label={`${t("bots.name")} *`} className="min-w-0 flex-1">
              <Input
                value={form.name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, name: e.target.value }))
                }
                placeholder={t("bots.namePlaceholder")}
                maxLength={30}
              />
            </Field>
          </div>

          <Field label={t("bots.description")}>
            <Textarea
              value={form.description}
              onChange={(e) =>
                setForm((f) => ({ ...f, description: e.target.value }))
              }
              placeholder={t("bots.descriptionPlaceholder")}
              rows={6}
              maxLength={1000}
            />
            <div className="text-right text-[11px] text-ink-tertiary">
              {form.description.length}/1000
            </div>
          </Field>

          <Field label={t("bots.tags")}>
            <TagInput
              value={form.tags}
              onChange={(tags) => setForm((f) => ({ ...f, tags }))}
              placeholder={t("bots.tagsPlaceholder")}
            />
          </Field>

          <label className="flex cursor-pointer items-center gap-3">
            <AppSwitch
              checked={form.autoReply}
              onCheckedChange={(v) => setForm((f) => ({ ...f, autoReply: v }))}
            />
            <div>
              <span className="text-[13px] font-medium text-ink">
                {t("bots.autoReply")}
              </span>
              <p className="text-xs text-ink-tertiary">
                {t("bots.autoReplyDesc")}
              </p>
            </div>
          </label>

          <Field label={t("bots.model")}>
            <Input
              value={form.model}
              onChange={(e) =>
                setForm((f) => ({ ...f, model: e.target.value }))
              }
              placeholder={t("bots.modelPlaceholder")}
            />
          </Field>
        </div>
      </Modal>

      <ConfirmDialog
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => void confirmDelete()}
        title={t("bots.delete")}
        description={
          deleteTarget
            ? t("bots.deleteConfirm", { name: deleteTarget.name })
            : ""
        }
        confirmLabel={t("bots.delete")}
        danger
      />

      <ConfirmDialog
        open={discardOpen}
        onClose={() => setDiscardOpen(false)}
        onConfirm={handleDiscard}
        title={t("bots.unsaved")}
        confirmLabel={t("common.confirm")}
      />
    </div>
  )
}
