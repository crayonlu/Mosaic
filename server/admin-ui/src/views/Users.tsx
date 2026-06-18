import {
  ChevronLeft,
  ChevronRight,
  Loader,
  Plus,
  RotateCcw,
  ShieldCheck,
  User,
  UserX,
} from "lucide-react"
import { useCallback, useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import {
  adminApi,
  type CreateUserRequest,
  type ManagedUser,
  type UpdateManagedUserRequest,
} from "../api"
import Modal from "../components/Modal"
import { Badge } from "../components/ui/badge"
import { Button } from "../components/ui/button"
import { Input } from "../components/ui/input"
import { Label } from "../components/ui/label"
import { useToast } from "../hooks/useToast"
import { useAuthStore } from "../stores/authStore"

function fmtDate(ts: number) {
  const d = new Date(ts * 1000)
  return d.toLocaleDateString()
}

export default function Users() {
  const { t } = useTranslation()
  const toast = useToast()
  const currentUser = useAuthStore((s) => s.user)

  const [users, setUsers] = useState<ManagedUser[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const pageSize = 50

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

  const loadUsers = useCallback(async () => {
    setLoading(true)
    try {
      const data = (await adminApi(
        `/users?page=${page}&page_size=${pageSize}`
      )) as {
        users: ManagedUser[]
        total: number
        page: number
        pageSize: number
      }
      setUsers(data.users)
      setTotal(data.total)
    } catch {
      toast.error(t("users.loadFailed"))
    } finally {
      setLoading(false)
    }
  }, [t, toast, page])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadUsers()
  }, [loadUsers])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!createForm.username.trim() || !createForm.password) {
      toast.error(t("changePassword.fillAll"))
      return
    }
    if (createForm.password.length < 8) {
      toast.error(t("changePassword.tooShort"))
      return
    }
    setCreating(true)
    try {
      await adminApi("/users", { method: "POST", body: createForm })
      toast.success(t("users.createSuccess"))
      setCreateOpen(false)
      setCreateForm({ username: "", password: "" })
      await loadUsers()
    } catch {
      toast.error(t("users.createFailed"))
    } finally {
      setCreating(false)
    }
  }

  async function toggleActive(user: ManagedUser) {
    if (user.id === currentUser?.id) {
      toast.error(t("users.cannotDisableSelf"))
      return
    }
    const body: UpdateManagedUserRequest = { isActive: !user.isActive }
    try {
      await adminApi(`/users/${user.id}`, { method: "PATCH", body })
      toast.success(t("users.updateSuccess"))
      await loadUsers()
    } catch {
      toast.error(t("users.updateFailed"))
    }
  }

  async function toggleRole(user: ManagedUser) {
    const newRole = user.role === "admin" ? "user" : "admin"
    try {
      await adminApi(`/users/${user.id}`, {
        method: "PATCH",
        body: { role: newRole } as UpdateManagedUserRequest,
      })
      toast.success(t("users.updateSuccess"))
      await loadUsers()
    } catch {
      toast.error(t("users.updateFailed"))
    }
  }

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault()
    if (!resetTarget || !resetPassword) return
    if (resetPassword.length < 8) {
      toast.error(t("changePassword.tooShort"))
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
      await loadUsers()
    } catch {
      toast.error(t("users.updateFailed"))
    } finally {
      setResetting(false)
    }
  }

  if (currentUser?.role !== "admin") {
    return (
      <div className="mx-auto max-w-300 py-8 text-center text-muted-foreground">
        {t("users.noAccess")}
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-300 space-y-4 py-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-foreground">
          {t("users.title")}
        </h1>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus size={14} className="mr-1" />
          {t("users.create")}
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader size={20} className="animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">
                  {t("users.username")}
                </th>
                <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">
                  {t("users.role")}
                </th>
                <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">
                  {t("users.status")}
                </th>
                <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">
                  {t("users.createdAt")}
                </th>
                <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">
                  {t("users.actions")}
                </th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr
                  key={user.id}
                  className="border-b border-border last:border-0"
                >
                  <td className="px-4 py-2.5 font-medium text-foreground">
                    <div className="flex items-center gap-2">
                      <User size={14} className="text-muted-foreground" />
                      {user.username}
                    </div>
                  </td>
                  <td className="px-4 py-2.5">
                    <Badge
                      variant={user.role === "admin" ? "default" : "secondary"}
                      className="text-xs"
                    >
                      {user.role === "admin"
                        ? t("users.admin")
                        : t("users.user")}
                    </Badge>
                  </td>
                  <td className="px-4 py-2.5">
                    <Badge
                      variant={user.isActive ? "outline" : "destructive"}
                      className="text-xs"
                    >
                      {user.isActive ? t("users.active") : t("users.disabled")}
                    </Badge>
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">
                    {fmtDate(user.createdAt)}
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                        onClick={() => toggleActive(user)}
                        title={
                          user.isActive ? t("users.disable") : t("users.enable")
                        }
                      >
                        {user.isActive ? (
                          <UserX size={14} />
                        ) : (
                          <User size={14} />
                        )}
                      </button>
                      <button
                        className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                        onClick={() => toggleRole(user)}
                        title={t("users.changeRole")}
                      >
                        <ShieldCheck size={14} />
                      </button>
                      <button
                        className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                        onClick={() => {
                          setResetTarget(user)
                          setResetPassword("")
                          setResetOpen(true)
                        }}
                        title={t("users.resetPassword")}
                      >
                        <RotateCcw size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {total > pageSize && (
        <div className="flex items-center justify-between pt-2 text-sm text-muted-foreground">
          <span>{t("users.total", { count: total })}</span>
          <div className="flex items-center gap-1">
            <button
              className="rounded p-1 hover:bg-muted disabled:opacity-40"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
            >
              <ChevronLeft size={16} />
            </button>
            <span>
              {page} / {Math.ceil(total / pageSize)}
            </span>
            <button
              className="rounded p-1 hover:bg-muted disabled:opacity-40"
              onClick={() => setPage((p) => p + 1)}
              disabled={page >= Math.ceil(total / pageSize)}
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Create User Dialog */}
      <Modal show={createOpen} onClose={() => setCreateOpen(false)}>
        <form onSubmit={handleCreate} className="space-y-4">
          <h2 className="text-base font-semibold text-foreground">
            {t("users.create")}
          </h2>
          <div className="space-y-2">
            <Label>{t("users.username")}</Label>
            <Input
              value={createForm.username}
              onChange={(e) =>
                setCreateForm((f) => ({ ...f, username: e.target.value }))
              }
              autoComplete="off"
            />
          </div>
          <div className="space-y-2">
            <Label>{t("users.password")}</Label>
            <Input
              type="password"
              value={createForm.password}
              onChange={(e) =>
                setCreateForm((f) => ({ ...f, password: e.target.value }))
              }
              autoComplete="new-password"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setCreateOpen(false)}
            >
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={creating}>
              {creating ? t("common.saving") : t("users.create")}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Reset Password Dialog */}
      <Modal show={resetOpen} onClose={() => setResetOpen(false)}>
        <form onSubmit={handleResetPassword} className="space-y-4">
          <h2 className="text-base font-semibold text-foreground">
            {t("users.resetPassword")} - {resetTarget?.username}
          </h2>
          <div className="space-y-2">
            <Label>{t("users.newPassword")}</Label>
            <Input
              type="password"
              value={resetPassword}
              onChange={(e) => setResetPassword(e.target.value)}
              autoComplete="new-password"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setResetOpen(false)}
            >
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={resetting}>
              {resetting ? t("common.saving") : t("users.resetPassword")}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
