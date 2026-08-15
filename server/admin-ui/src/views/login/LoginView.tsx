import { Eye, EyeSlash, Globe, Lock, Sun, User } from "@phosphor-icons/react"
import { useState, type FormEvent, type ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { useNavigate } from "react-router-dom"
import { getServerUrl, setServerUrl } from "../../api"
import { AppLogo } from "../../components/AppLogo"
import { AppTooltip } from "../../components/ui/tooltip"
import { LoadingSpinner } from "../../components/ui/spinner"
import { useAuthStore } from "../../stores/authStore"
import { useThemeStore } from "../../stores/themeStore"

const isDev = import.meta.env.DEV

function LoginField({
  label,
  icon,
  children,
}: {
  label: string
  icon: ReactNode
  children: ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[13px] font-medium text-ink-secondary">
        {label}
      </label>
      <div className="flex items-center gap-2.5 rounded-md bg-subtle px-3 transition-colors focus-within:bg-surface focus-within:ring-1 focus-within:ring-primary/50 focus-within:ring-inset">
        <span className="shrink-0 text-ink-tertiary">{icon}</span>
        {children}
      </div>
    </div>
  )
}

export default function LoginView() {
  const { t } = useTranslation()
  const auth = useAuthStore()
  const theme = useThemeStore()
  const navigate = useNavigate()

  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [serverUrl, setServerUrlState] = useState(() => getServerUrl())
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState("")

  function handleServerUrlChange(url: string) {
    setServerUrlState(url)
    setServerUrl(url)
  }

  async function handleLogin(e: FormEvent) {
    e.preventDefault()
    setErrorMsg("")
    if (!username.trim() || !password.trim()) {
      setErrorMsg(t("login.fillCredentials"))
      return
    }
    setLoading(true)
    try {
      await auth.login(username, password)
      navigate("/overview", { replace: true })
    } catch {
      setErrorMsg(t("login.loginFailed"))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas px-4">
      <div className="absolute top-4 right-4">
        <AppTooltip content={t("nav.theme")}>
          <button
            type="button"
            onClick={theme.cycle}
            className="flex size-10 items-center justify-center rounded-md text-ink-tertiary transition-colors hover:bg-subtle hover:text-ink"
            aria-label={t("nav.theme")}
          >
            <Sun size={16} />
          </button>
        </AppTooltip>
      </div>

      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-xl bg-primary-soft">
            <AppLogo className="size-6" />
          </div>
          <h1 className="text-xl font-semibold tracking-[-0.01em] text-ink">
            {t("login.title")}
          </h1>
          <p className="mt-1.5 text-sm text-ink-secondary">
            {t("login.subtitle")}
          </p>
        </div>

        <form onSubmit={handleLogin} className="flex flex-col gap-4">
          <LoginField label={t("login.username")} icon={<User size={15} />}>
            <input
              id="username"
              type="text"
              className="min-w-0 flex-1 border-none bg-transparent py-2.5 text-base text-ink outline-none placeholder:text-ink-tertiary md:text-sm"
              placeholder={t("login.usernamePlaceholder")}
              autoComplete="username"
              disabled={loading}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </LoginField>

          <LoginField label={t("login.password")} icon={<Lock size={15} />}>
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              className="min-w-0 flex-1 border-none bg-transparent py-2.5 text-base text-ink outline-none placeholder:text-ink-tertiary md:text-sm"
              placeholder={t("login.passwordPlaceholder")}
              autoComplete="current-password"
              disabled={loading}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="flex size-8 shrink-0 items-center justify-center rounded-md text-ink-tertiary transition-colors hover:text-ink"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeSlash size={15} /> : <Eye size={15} />}
            </button>
          </LoginField>

          {isDev && (
            <LoginField label={t("login.serverUrl")} icon={<Globe size={15} />}>
              <input
                id="serverUrl"
                type="text"
                className="min-w-0 flex-1 border-none bg-transparent py-2.5 text-base text-ink outline-none placeholder:text-ink-tertiary md:text-sm"
                placeholder={t("login.serverUrlPlaceholder")}
                disabled={loading}
                value={serverUrl}
                onChange={(e) => handleServerUrlChange(e.target.value)}
              />
            </LoginField>
          )}

          {errorMsg && <p className="text-[13px] text-error">{errorMsg}</p>}

          <button
            type="submit"
            disabled={loading}
            className="mt-1 inline-flex h-[44px] items-center justify-center gap-2 rounded-md bg-primary text-sm font-medium text-on-primary transition-colors hover:bg-primary-hover disabled:pointer-events-none disabled:opacity-60"
          >
            {loading ? <LoadingSpinner size={15} /> : t("login.login")}
          </button>
        </form>
      </div>
    </div>
  )
}
