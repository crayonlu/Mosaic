import { DotsThree, Plus, UsersThree } from "@phosphor-icons/react"
import { useCallback, useState } from "react"
import { useTranslation } from "react-i18next"
import {
  adminApi,
  type AiConfigItem,
  type CreateUserRequest,
  type ManagedUser,
  type UpdateManagedUserRequest,
  type UsersResponse,
} from "../../api"
import { Avatar } from "../../components/ui/avatar"
import { Badge } from "../../components/ui/badge"
import { Button } from "../../components/ui/button"
import { ConfirmDialog } from "../../components/ui/confirm-dialog"
import { EmptyState } from "../../components/ui/empty-state"
import { ErrorState } from "../../components/ui/error-state"
import { Field } from "../../components/ui/field"
import { Input } from "../../components/ui/input"
import { Modal } from "../../components/ui/dialog"
import { ModelCombobox } from "../../components/ui/combobox"
import { PageHeader } from "../../components/ui/page-header"
import { Pagination } from "../../components/ui/pagination"
import { Skeleton } from "../../components/ui/skeleton"
import { AppTabs, TabPanel } from "../../components/ui/tabs"
import { AppMenu } from "../../components/ui/menu"
import { AppSwitch } from "../../components/ui/switch"
import { useAuthStore } from "../../stores/authStore"
import { useAsyncData } from "../../hooks/useAsyncData"
import { useToast } from "../../hooks/useToast"
import { formatDate } from "../../lib/utils"

const PAGE_SIZE = 50

type ConfirmKind = "disable" | "enable" | "role"

interface AiForm {
  baseUrl: string
  apiKey: string
  model: string
  maxTokens?: number
  supportsVision: boolean
  supportsThinking: boolean
}

const emptyAiForm: AiForm = {
  baseUrl: "",
  apiKey: "",
  model: "",
  supportsVision: false,
  supportsThinking: false,
}

export default function UsersView() {
  const { t } = useTranslation()
  const toast = useToast()
  const currentUser = useAuthStore((s) => s.user)

  const [page, setPage] = useState(1)
  const users = useAsyncData<UsersResponse>(
    useCallback(
      () =>
        adminApi(
          `/users?page=${page}&page_size=${PAGE_SIZE}`
        ) as Promise<UsersResponse>,
      [page]
    )
  )

  const [createOpen, setCreateOpen] = useState(false)
  const [createForm, setCreateForm] = useState<CreateUserRequest>({
    username: "",
    password: "",
  })
  const [creating, setCreating] = useState(false)

  const [resetOpen, setResetOpen] = useState(false)
  const [resetTarget, setResetTarget] = useState<ManagedUser | null>(null)
  const [resetPassword, setResetPassword] = useState("")
  const [resetting, setResetting] = useState(false)

  const [detailUser, setDetailUser] = useState<ManagedUser | null>(null)
  const [detailTab, setDetailTab] = useState<"basic" | "ai">("basic")
  const [aiForm, setAiForm] = useState<AiForm>(emptyAiForm)
  const [aiSaving, setAiSaving] = useState(false)

  const [confirm, setConfirm] = useState<{
    kind: ConfirmKind
    user: ManagedUser
  } | null>(null)
  const [confirmBusy, setConfirmBusy] = useState(false)

  if (currentUser?.role !== "admin") {
    return (
      <EmptyState icon={<UsersThree size={18} />} title={t("users.noAccess")} />
    )
  }

  const totalPages = Math.max(
    1,
    Math.ceil((users.data?.total ?? 0) / PAGE_SIZE)
  )

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!createForm.username.trim() || !createForm.password) {
      toast.error(t("account.fillAll"))
      return
    }
    if (createForm.password.length < 8) {
      toast.error(t("account.tooShort"))
      return
    }
    setCreating(true)
    try {
      await adminApi("/users", { method: "POST", body: createForm })
      toast.success(t("users.createSuccess"))
      setCreateOpen(false)
      setCreateForm({ username: "", password: "" })
      await users.refetch()
    } catch {
      toast.error(t("users.createFailed"))
    } finally {
      setCreating(false)
    }
  }

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault()
    if (!resetTarget || !resetPassword) return
    if (resetPassword.length < 8) {
      toast.error(t("account.tooShort"))
      return
    }
    setResetting(true)
    try {
      await adminApi(`/users/${resetTarget.id}`, {
        method: "PATCH",
        body: { resetPassword } as UpdateManagedUserRequest,
      })
      toast.success(t("users.updateSuccess"))
      setResetOpen(false)
      setResetTarget(null)
      setResetPassword("")
      await users.refetch()
    } catch {
      toast.error(t("users.updateFailed"))
    } finally {
      setResetting(false)
    }
  }

  async function runConfirm() {
    if (!confirm) return
    const { kind, user } = confirm
    if (user.id === currentUser?.id && kind === "disable") {
      toast.error(t("users.cannotDisableSelf"))
      setConfirm(null)
      return
    }
    if (user.id === currentUser?.id && kind === "role") {
      toast.error(t("users.selfRoleWarning"))
      setConfirm(null)
      return
    }
    setConfirmBusy(true)
    try {
      const body: UpdateManagedUserRequest =
        kind === "disable" || kind === "enable"
          ? { isActive: kind === "enable" }
          : { role: user.role === "admin" ? "user" : "admin" }
      await adminApi(`/users/${user.id}`, { method: "PATCH", body })
      toast.success(t("users.updateSuccess"))
      setConfirm(null)
      await users.refetch()
      if (detailUser?.id === user.id) {
        setDetailUser(
          body.isActive !== undefined
            ? { ...user, isActive: body.isActive }
            : body.role
              ? { ...user, role: body.role }
              : user
        )
      }
    } catch {
      toast.error(t("users.updateFailed"))
    } finally {
      setConfirmBusy(false)
    }
  }

  async function openDetail(user: ManagedUser) {
    setDetailUser(user)
    setDetailTab("basic")
    await loadAiConfig(user.id)
  }

  async function loadAiConfig(userId: string) {
    setAiForm(emptyAiForm)
    try {
      const item = (await adminApi(
        `/users/${userId}/ai-config`
      )) as AiConfigItem
      setAiForm({
        baseUrl: item.baseUrl ?? "",
        apiKey: item.apiKey ?? "",
        model: item.model ?? "",
        maxTokens: item.maxTokens ?? undefined,
        supportsVision: item.supportsVision ?? false,
        supportsThinking: item.supportsThinking ?? false,
      })
    } catch {
      toast.error(t("aiSettings.saveFailed"))
    }
  }

  async function saveAiConfig() {
    if (!detailUser) return
    setAiSaving(true)
    try {
      await adminApi(`/users/${detailUser.id}/ai-config`, {
        method: "PUT",
        body: {
          provider: "openai",
          baseUrl: aiForm.baseUrl,
          apiKey: aiForm.apiKey,
          model: aiForm.model,
          maxTokens: aiForm.maxTokens,
          supportsVision: aiForm.supportsVision,
          supportsThinking: aiForm.supportsThinking,
        },
      })
      toast.success(t("aiSettings.saved"))
    } catch {
      toast.error(t("aiSettings.saveFailed"))
    } finally {
      setAiSaving(false)
    }
  }

  const confirmCopy = confirm
    ? confirm.kind === "disable"
      ? {
          title: t("users.disable"),
          desc: t("users.disableConfirm", { name: confirm.user.username }),
        }
      : confirm.kind === "enable"
        ? {
            title: t("users.enable"),
            desc: t("users.enableConfirm", { name: confirm.user.username }),
          }
        : {
            title: t("users.changeRole"),
            desc: t("users.roleConfirm", {
              name: confirm.user.username,
              role:
                confirm.user.role === "admin"
                  ? t("users.user")
                  : t("users.admin"),
            }),
          }
    : null

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("users.title")}
        actions={
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus size={13} />
            {t("users.create")}
          </Button>
        }
      />

      {users.loading && !users.data ? (
        <div className="space-y-2">
          <Skeleton className="h-10" />
          <Skeleton className="h-10" />
          <Skeleton className="h-10" />
        </div>
      ) : users.error ? (
        <ErrorState message={users.error} onRetry={users.refetch} />
      ) : !users.data?.users || users.data.users.length === 0 ? (
        <EmptyState
          icon={<UsersThree size={18} />}
          title={t("users.empty")}
          action={
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus size={13} />
              {t("users.create")}
            </Button>
          }
        />
      ) : (
        <>
          <div className="animate-fade-in overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse">
              <thead>
                <tr className="border-b border-hairline text-left">
                  <th className="px-3 py-2.5 text-xs font-medium text-ink-tertiary">
                    {t("users.username")}
                  </th>
                  <th className="px-3 py-2.5 text-xs font-medium text-ink-tertiary">
                    {t("users.role")}
                  </th>
                  <th className="px-3 py-2.5 text-xs font-medium text-ink-tertiary">
                    {t("users.status")}
                  </th>
                  <th className="px-3 py-2.5 text-xs font-medium text-ink-tertiary">
                    {t("users.createdAt")}
                  </th>
                  <th className="px-3 py-2.5 text-right text-xs font-medium text-ink-tertiary">
                    {t("users.actions")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {users.data.users.map((user) => (
                  <tr
                    key={user.id}
                    className="border-b border-hairline transition-colors last:border-0 hover:bg-subtle/60"
                  >
                    <td className="px-3 py-2.5">
                      <button
                        type="button"
                        onClick={() => void openDetail(user)}
                        className="flex items-center gap-2.5 text-left"
                      >
                        <Avatar
                          src={user.avatarUrl}
                          initials={user.username}
                          className="size-8"
                        />
                        <span className="text-[13px] font-medium text-ink">
                          {user.username}
                        </span>
                        {user.id === currentUser?.id && (
                          <Badge
                            variant="outline"
                            className="hidden sm:inline-flex"
                          >
                            {t("users.self")}
                          </Badge>
                        )}
                      </button>
                    </td>
                    <td className="px-3 py-2.5">
                      <Badge
                        variant={user.role === "admin" ? "neutral" : "outline"}
                      >
                        {user.role === "admin"
                          ? t("users.admin")
                          : t("users.user")}
                      </Badge>
                    </td>
                    <td className="px-3 py-2.5">
                      <Badge variant={user.isActive ? "success" : "error"}>
                        {user.isActive
                          ? t("users.active")
                          : t("users.disabled")}
                      </Badge>
                    </td>
                    <td className="px-3 py-2.5 text-[13px] text-ink-tertiary">
                      {formatDate(user.createdAt, "s")}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex justify-end">
                        <AppMenu
                          ariaLabel={t("users.actions")}
                          trigger={
                            <span className="flex size-[40px] items-center justify-center rounded-md text-ink-tertiary transition-colors hover:bg-subtle hover:text-ink md:size-8">
                              <DotsThree size={16} />
                            </span>
                          }
                          items={[
                            {
                              key: "detail",
                              label: t("users.detail"),
                              onSelect: () => void openDetail(user),
                            },
                            {
                              key: "toggle-active",
                              label: user.isActive
                                ? t("users.disable")
                                : t("users.enable"),
                              onSelect: () =>
                                setConfirm({
                                  kind: user.isActive ? "disable" : "enable",
                                  user,
                                }),
                              danger: user.isActive,
                            },
                            {
                              key: "role",
                              label: t("users.changeRole"),
                              onSelect: () =>
                                setConfirm({ kind: "role", user }),
                            },
                            {
                              key: "reset",
                              label: t("users.resetPassword"),
                              onSelect: () => {
                                setResetTarget(user)
                                setResetPassword("")
                                setResetOpen(true)
                              },
                            },
                          ]}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination
            page={page}
            totalPages={totalPages}
            total={users.data.total}
            onPageChange={setPage}
          />
        </>
      )}

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title={t("users.create")}
      >
        <form onSubmit={handleCreate} className="space-y-4">
          <Field label={t("users.username")}>
            <Input
              value={createForm.username}
              onChange={(e) =>
                setCreateForm((f) => ({ ...f, username: e.target.value }))
              }
              autoComplete="off"
            />
          </Field>
          <Field label={t("users.password")}>
            <Input
              type="password"
              value={createForm.password}
              onChange={(e) =>
                setCreateForm((f) => ({ ...f, password: e.target.value }))
              }
              autoComplete="new-password"
            />
          </Field>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setCreateOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={creating}>
              {creating ? t("common.saving") : t("users.create")}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={resetOpen}
        onClose={() => setResetOpen(false)}
        title={`${t("users.resetPassword")}${resetTarget ? ` — ${resetTarget.username}` : ""}`}
      >
        <form onSubmit={handleResetPassword} className="space-y-4">
          <Field label={t("users.newPassword")}>
            <Input
              type="password"
              value={resetPassword}
              onChange={(e) => setResetPassword(e.target.value)}
              autoComplete="new-password"
            />
          </Field>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setResetOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={resetting}>
              {resetting ? t("common.saving") : t("users.resetPassword")}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={detailUser !== null}
        onClose={() => setDetailUser(null)}
        title={
          detailUser ? `${t("users.detail")} — ${detailUser.username}` : ""
        }
        size="lg"
      >
        {detailUser && (
          <AppTabs
            value={detailTab}
            onValueChange={(v) => setDetailTab(v as "basic" | "ai")}
            tabs={[
              { value: "basic", label: t("users.basicInfo") },
              { value: "ai", label: t("users.aiConfig") },
            ]}
          >
            <TabPanel value="basic">
              <div className="flex items-center gap-4">
                <Avatar
                  src={detailUser.avatarUrl}
                  initials={detailUser.username}
                  className="size-14 text-base"
                />
                <div className="min-w-0">
                  <p className="text-[15px] font-semibold text-ink">
                    {detailUser.username}
                  </p>
                  <div className="mt-1.5 flex items-center gap-2">
                    <Badge
                      variant={
                        detailUser.role === "admin" ? "neutral" : "outline"
                      }
                    >
                      {detailUser.role === "admin"
                        ? t("users.admin")
                        : t("users.user")}
                    </Badge>
                    <Badge variant={detailUser.isActive ? "success" : "error"}>
                      {detailUser.isActive
                        ? t("users.active")
                        : t("users.disabled")}
                    </Badge>
                  </div>
                </div>
              </div>
              <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label={t("users.createdAt")}>
                  <div className="flex h-9 items-center text-sm text-ink">
                    {formatDate(detailUser.createdAt, "s")}
                  </div>
                </Field>
                <Field label={t("users.memberSince")}>
                  <div className="flex h-9 items-center text-sm text-ink">
                    {formatDate(detailUser.createdAt, "s")}
                  </div>
                </Field>
              </div>
            </TabPanel>
            <TabPanel value="ai">
              <div className="space-y-4">
                <p className="text-xs text-ink-tertiary">
                  {t("users.aiConfigDesc")}
                </p>
                <Field label={t("aiSettings.baseUrl")}>
                  <Input
                    value={aiForm.baseUrl}
                    onChange={(e) =>
                      setAiForm((f) => ({ ...f, baseUrl: e.target.value }))
                    }
                    placeholder={t("aiSettings.apiUrlPlaceholder")}
                  />
                </Field>
                <Field label={t("aiSettings.apiKey")}>
                  <Input
                    type="password"
                    value={aiForm.apiKey}
                    onChange={(e) =>
                      setAiForm((f) => ({ ...f, apiKey: e.target.value }))
                    }
                    placeholder={t("aiSettings.apiKeyPlaceholder")}
                    autoComplete="off"
                  />
                </Field>
                <Field label={t("aiSettings.model")}>
                  <ModelCombobox
                    value={aiForm.model}
                    onChange={(model) => setAiForm((f) => ({ ...f, model }))}
                    baseUrl={aiForm.baseUrl}
                    apiKey={aiForm.apiKey}
                    placeholder={t("aiSettings.modelPlaceholder")}
                  />
                </Field>
                <Field
                  label={t("aiSettings.maxTokens")}
                  hint={t("aiSettings.maxTokensDesc")}
                >
                  <Input
                    type="number"
                    min={1}
                    max={128000}
                    value={aiForm.maxTokens ?? ""}
                    onChange={(e) =>
                      setAiForm((f) => ({
                        ...f,
                        maxTokens: e.target.value
                          ? Number(e.target.value)
                          : undefined,
                      }))
                    }
                  />
                </Field>
                <div className="flex flex-col gap-3">
                  <span className="text-[13px] font-medium text-ink">
                    {t("aiSettings.capabilities")}
                  </span>
                  <label className="flex cursor-pointer items-center justify-between gap-3">
                    <span className="text-[13px] text-ink">
                      {t("aiSettings.vision")}
                    </span>
                    <AppSwitch
                      checked={aiForm.supportsVision}
                      onCheckedChange={(v) =>
                        setAiForm((f) => ({ ...f, supportsVision: v }))
                      }
                    />
                  </label>
                  <label className="flex cursor-pointer items-center justify-between gap-3">
                    <span className="text-[13px] text-ink">
                      {t("aiSettings.thinking")}
                    </span>
                    <AppSwitch
                      checked={aiForm.supportsThinking}
                      onCheckedChange={(v) =>
                        setAiForm((f) => ({ ...f, supportsThinking: v }))
                      }
                    />
                  </label>
                </div>
                <Button
                  className="w-full"
                  disabled={aiSaving}
                  onClick={() => void saveAiConfig()}
                >
                  {aiSaving ? t("common.saving") : t("aiSettings.save")}
                </Button>
              </div>
            </TabPanel>
          </AppTabs>
        )}
      </Modal>

      <ConfirmDialog
        open={confirm !== null}
        onClose={() => !confirmBusy && setConfirm(null)}
        onConfirm={() => void runConfirm()}
        title={confirmCopy?.title ?? ""}
        description={confirmCopy?.desc ?? ""}
        confirmLabel={confirmCopy?.title ?? ""}
        danger={confirm?.kind === "disable"}
        loading={confirmBusy}
      />
    </div>
  )
}
