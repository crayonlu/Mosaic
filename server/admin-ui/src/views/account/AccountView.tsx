import { Info } from "@phosphor-icons/react"
import { useState, type FormEvent, type ReactNode } from "react"
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
    <div className="mx-auto max-w-xl space-y-10">
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
        <div className="divide-y divide-hairline">
          <ProfileRow
            label={t("account.username")}
            value={user?.username ?? "—"}
          />
          <ProfileRow
            label={t("account.role")}
            value={
              <Badge variant={user?.role === "admin" ? "neutral" : "outline"}>
                {user?.role === "admin"
                  ? t("account.admin")
                  : t("account.user")}
              </Badge>
            }
          />
          <ProfileRow
            label={t("account.memberSince")}
            value={user ? formatDate(user.createdAt, "s") : "—"}
          />
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-[15px] font-semibold text-ink">
          {t("account.changePassword")}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
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
          <Button type="submit" className="w-full" disabled={saving}>
            {saving ? t("common.saving") : t("account.submit")}
          </Button>
        </form>
      </section>
    </div>
  )
}

function ProfileRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-6 py-3">
      <span className="text-[13px] text-ink-secondary">{label}</span>
      <span className="min-w-0 truncate text-[13px] font-medium text-ink">
        {value}
      </span>
    </div>
  )
}
