import { Globe, Loader, Lock, Palette, User } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { useNavigate } from "react-router-dom"
import { getServerUrl, setServerUrl } from "../api"
import { useToast } from "../hooks/useToast"
import { useAuthStore } from "../stores/authStore"
import { useThemeStore } from "../stores/themeStore"

const isDev = import.meta.env.DEV

export default function Login() {
  const { t } = useTranslation()
  const auth = useAuthStore()
  const theme = useThemeStore()
  const navigate = useNavigate()
  const toast = useToast()

  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [serverUrl, setServerUrlState] = useState(() => getServerUrl())
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState("")

  function toggleTheme() {
    theme.setThemeName(
      theme.themeName === "quietPaper" ? "cleanSlate" : "quietPaper"
    )
  }

  function handleServerUrlChange(url: string) {
    setServerUrlState(url)
    setServerUrl(url)
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setErrorMsg("")
    if (!username.trim() || !password.trim()) {
      setErrorMsg(t("login.fillCredentials"))
      return
    }
    setLoading(true)
    try {
      await auth.login(username, password)
      navigate("/dashboard", { replace: true })
    } catch {
      setErrorMsg(t("login.loginFailed"))
      toast.error(t("login.loginFailed"))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4 sm:p-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex size-11 items-center justify-center rounded-xl bg-primary/10">
            <svg
              className="size-6 text-primary"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
            >
              <rect x={3} y={3} width={7} height={7} rx={1.5} />
              <rect x={14} y={3} width={7} height={7} rx={1.5} />
              <rect x={3} y={14} width={7} height={7} rx={1.5} />
              <rect x={14} y={14} width={7} height={7} rx={1.5} />
            </svg>
          </div>
          <h1 className="text-xl font-semibold text-foreground">
            {t("login.title")}
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {t("login.subtitle")}
          </p>
        </div>

        <div className="p-6">
          <form onSubmit={handleLogin} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="username"
                className="text-xs font-medium text-muted-foreground"
              >
                {t("login.username")}
              </label>
              <div className="flex items-center gap-2 rounded-md border border-transparent bg-muted px-3 transition-colors focus-within:border-ring">
                <User size={15} className="shrink-0 text-muted-foreground" />
                <input
                  id="username"
                  type="text"
                  className="flex-1 border-none bg-transparent py-2.5 font-sans text-sm text-foreground outline-none"
                  placeholder={t("login.usernamePlaceholder")}
                  autoComplete="username"
                  disabled={loading}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="password"
                className="text-xs font-medium text-muted-foreground"
              >
                {t("login.password")}
              </label>
              <div className="flex items-center gap-2 rounded-md border border-transparent bg-muted px-3 transition-colors focus-within:border-ring">
                <Lock size={15} className="shrink-0 text-muted-foreground" />
                <input
                  id="password"
                  type="password"
                  className="flex-1 border-none bg-transparent py-2.5 font-sans text-sm text-foreground outline-none"
                  placeholder={t("login.passwordPlaceholder")}
                  autoComplete="current-password"
                  disabled={loading}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>

            {isDev && (
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="serverUrl"
                  className="text-xs font-medium text-muted-foreground"
                >
                  {t("login.serverUrl")}
                </label>
                <div className="flex items-center gap-2 rounded-md border border-transparent bg-muted px-3 transition-colors focus-within:border-ring">
                  <Globe size={15} className="shrink-0 text-muted-foreground" />
                  <input
                    id="serverUrl"
                    type="text"
                    className="flex-1 border-none bg-transparent py-2.5 font-sans text-sm text-foreground outline-none"
                    placeholder={t("login.serverUrlPlaceholder")}
                    disabled={loading}
                    value={serverUrl}
                    onChange={(e) => handleServerUrlChange(e.target.value)}
                  />
                </div>
              </div>
            )}

            {errorMsg && <p className="text-xs text-destructive">{errorMsg}</p>}

            <button
              type="submit"
              className="mt-1 inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
              disabled={loading}
            >
              {loading ? (
                <Loader size={15} className="spin" />
              ) : (
                <span>{t("login.login")}</span>
              )}
            </button>
          </form>
        </div>

        <div className="mt-4 flex justify-center">
          <button
            className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            onClick={toggleTheme}
          >
            <Palette size={13} />
            {theme.themeName === "quietPaper"
              ? t("layout.themeCleanSlate")
              : t("layout.themeQuietPaper")}
          </button>
        </div>
      </div>
    </div>
  )
}
