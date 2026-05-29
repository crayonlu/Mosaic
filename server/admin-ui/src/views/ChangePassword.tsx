import { useState } from "react"
import { useTranslation } from "react-i18next"
import { useNavigate } from "react-router-dom"
import { api, setToken } from "../api"
import { Button } from "../components/ui/button"
import { Card } from "../components/ui/card"
import { Input } from "../components/ui/input"
import { Label } from "../components/ui/label"
import { useToast } from "../hooks/useToast"
import { useAuthStore } from "../stores/authStore"

export default function ChangePassword() {
  const { t } = useTranslation()
  const toast = useToast()
  const navigate = useNavigate()
  const clearMustChangePassword = useAuthStore((s) => s.clearMustChangePassword)

  const [oldPassword, setOldPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!oldPassword || !newPassword || !confirmPassword) {
      toast.error(t("changePassword.fillAll"))
      return
    }
    if (newPassword !== confirmPassword) {
      toast.error(t("changePassword.mismatch"))
      return
    }
    if (newPassword.length < 8) {
      toast.error(t("changePassword.tooShort"))
      return
    }

    setSaving(true)
    try {
      const tokens = (await api("/auth/change-password", {
        method: "POST",
        body: { oldPassword, newPassword },
      })) as { accessToken: string; refreshToken: string }
      setToken(tokens.accessToken, tokens.refreshToken)
      toast.success(t("changePassword.success"))
      clearMustChangePassword()
      navigate("/dashboard", { replace: true })
    } catch {
      toast.error(t("changePassword.failed"))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex min-h-[80vh] items-center justify-center px-4">
      <Card className="w-full max-w-sm p-6">
        <div className="mb-6 text-center">
          <h1 className="text-xl font-bold text-foreground">
            {t("changePassword.title")}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {t("changePassword.subtitle")}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>{t("changePassword.oldPassword")}</Label>
            <Input
              type="password"
              value={oldPassword}
              onChange={(e) => setOldPassword(e.target.value)}
              autoComplete="current-password"
            />
          </div>
          <div className="space-y-2">
            <Label>{t("changePassword.newPassword")}</Label>
            <Input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              autoComplete="new-password"
            />
          </div>
          <div className="space-y-2">
            <Label>{t("changePassword.confirmPassword")}</Label>
            <Input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
            />
          </div>
          <Button type="submit" className="w-full" disabled={saving}>
            {saving ? t("common.saving") : t("changePassword.submit")}
          </Button>
        </form>
      </Card>
    </div>
  )
}
