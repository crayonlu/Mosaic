import { Info } from "@phosphor-icons/react"
import { useState, type FormEvent } from "react"
import { useTranslation } from "react-i18next"
import { useNavigate } from "react-router-dom"
import { api, setToken } from "../../api"
import { Badge } from "../../components/ui/badge"
import { Button } from "../../components/ui/button"
import { Field } from "../../components/ui/field"
import { Input } from "../../components/ui/input"
import { PageHeader } from "../../components/ui/page-header"
import { useAuthStore } from "../../stores/authStore"
import { useToast } from "../../hooks/useToast"
import { formatDate } from "../../lib/utils"

export default function AccountView() {
  const { t } = useTranslation()
  const toast = useToast()
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const mustChangePassword = useAuthStore((s) => s.mustChangePassword)
  const clearMustChangePassword = useAuthStore((s) => s.clearMustChangePassword)

  const [oldPassword, setOldPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!oldPassword || !newPassword || !confirmPassword) {
      toast.error(t("account.fillAll"))
      return
    }
    if (newPassword !== confirmPassword) {
      toast.error(t("account.mismatch"))
      return
    }
    if (newPassword.length < 8) {
      toast.error(t("account.tooShort"))
      return
    }
    setSaving(true)
    try {
      const tokens = (await api("/auth/change-password", {
        method: "POST",
        body: { oldPassword, newPassword },
      })) as { accessToken: string; refreshToken: string }
      setToken(tokens.accessToken, tokens.refreshToken)
      toast.success(t("account.success"))
      clearMustChangePassword()
      setOldPassword("")
      setNewPassword("")
      setConfirmPassword("")
      navigate("/overview", { replace: true })
    } catch {
      toast.error(t("account.failed"))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <PageHeader title={t("account.title")} />

      {mustChangePassword && (
        <div className="flex items-start gap-2.5 rounded-lg bg-info/10 px-4 py-3 text-[13px] text-info">
          <Info size={16} className="mt-0.5 shrink-0" />
          {t("account.subtitle")}
        </div>
      )}

      <section className="space-y-4">
        <h2 className="text-[15px] font-semibold text-ink">
          {t("account.profile")}
        </h2>
        <div className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
          <Field label={t("account.username")}>
            <div className="flex h-10 items-center rounded-md bg-subtle px-3 text-sm text-ink md:h-9">
              {user?.username ?? "—"}
            </div>
          </Field>
          <Field label={t("account.role")}>
            <div className="flex h-10 items-center md:h-9">
              <Badge variant={user?.role === "admin" ? "neutral" : "outline"}>
                {user?.role === "admin"
                  ? t("account.admin")
                  : t("account.user")}
              </Badge>
            </div>
          </Field>
          <Field label={t("account.memberSince")}>
            <div className="flex h-10 items-center rounded-md bg-subtle px-3 text-sm text-ink md:h-9">
              {user ? formatDate(user.createdAt, "s") : "—"}
            </div>
          </Field>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-[15px] font-semibold text-ink">
          {t("account.changePassword")}
        </h2>
        <form onSubmit={handleSubmit} className="max-w-sm space-y-4">
          <Field label={t("account.oldPassword")}>
            <Input
              type="password"
              value={oldPassword}
              onChange={(e) => setOldPassword(e.target.value)}
              autoComplete="current-password"
            />
          </Field>
          <Field label={t("account.newPassword")}>
            <Input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              autoComplete="new-password"
            />
          </Field>
          <Field label={t("account.confirmPassword")}>
            <Input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
            />
          </Field>
          <Button type="submit" disabled={saving}>
            {saving ? t("common.saving") : t("account.submit")}
          </Button>
        </form>
      </section>
    </div>
  )
}
