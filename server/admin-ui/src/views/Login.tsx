import { Globe, Loader, Lock, Moon, Sun, User } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getServerUrl, setServerUrl } from '../api'
import { useToast } from '../hooks/useToast'
import { useAuthStore } from '../stores/authStore'
import { useThemeStore } from '../stores/themeStore'

const isDev = import.meta.env.DEV

export default function Login() {
  const auth = useAuthStore()
  const theme = useThemeStore()
  const navigate = useNavigate()
  const toast = useToast()

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [serverUrl, setServerUrlState] = useState(() => getServerUrl())
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  function toggleMode() {
    theme.setMode(theme.resolvedMode === 'dark' ? 'light' : 'dark')
  }

  function handleServerUrlChange(url: string) {
    setServerUrlState(url)
    setServerUrl(url)
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setErrorMsg('')
    if (!username.trim() || !password.trim()) {
      setErrorMsg('请填写用户名和密码')
      return
    }
    setLoading(true)
    try {
      await auth.login(username, password)
      navigate('/dashboard', { replace: true })
    } catch {
      setErrorMsg('登录失败，请检查用户名和密码')
      toast.error('登录失败，请检查用户名和密码')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-3 sm:p-6 transition-colors">
      <div className="w-full max-w-[380px] rounded-xl bg-card p-5 shadow-md sm:p-9">
        <div className="mb-6 text-center sm:mb-7">
          <svg className="mx-auto mb-3 size-10 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <rect x={3} y={3} width={7} height={7} rx={1.5} />
            <rect x={14} y={3} width={7} height={7} rx={1.5} />
            <rect x={3} y={14} width={7} height={7} rx={1.5} />
            <rect x={14} y={14} width={7} height={7} rx={1.5} />
          </svg>
          <h1 className="text-lg font-bold text-foreground">Mosaic 管理后台</h1>
          <p className="mt-1 text-sm text-muted-foreground">登录以管理您的 Mosaic 服务</p>
        </div>

        <form onSubmit={handleLogin} className="flex flex-col gap-3.5">
          <div className="flex flex-col gap-1">
            <label htmlFor="username" className="text-xs font-medium text-muted-foreground">用户名</label>
            <div className="flex items-center gap-2 rounded-md bg-muted px-3 border border-transparent focus-within:border-ring transition-colors">
              <User size={16} className="shrink-0 text-muted-foreground" />
              <input
                id="username"
                type="text"
                className="flex-1 border-none bg-transparent py-2.5 text-sm text-foreground font-sans outline-none"
                placeholder="请输入用户名"
                autoComplete="username"
                disabled={loading}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="password" className="text-xs font-medium text-muted-foreground">密码</label>
            <div className="flex items-center gap-2 rounded-md bg-muted px-3 border border-transparent focus-within:border-ring transition-colors">
              <Lock size={16} className="shrink-0 text-muted-foreground" />
              <input
                id="password"
                type="password"
                className="flex-1 border-none bg-transparent py-2.5 text-sm text-foreground font-sans outline-none"
                placeholder="请输入密码"
                autoComplete="current-password"
                disabled={loading}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          {isDev && (
            <div className="flex flex-col gap-1">
              <label htmlFor="serverUrl" className="text-xs font-medium text-muted-foreground">服务器地址</label>
              <div className="flex items-center gap-2 rounded-md bg-muted px-3 border border-transparent focus-within:border-ring transition-colors">
                <Globe size={16} className="shrink-0 text-muted-foreground" />
                <input
                  id="serverUrl"
                  type="text"
                  className="flex-1 border-none bg-transparent py-2.5 text-sm text-foreground font-sans outline-none"
                  placeholder="留空使用当前地址，如 http://192.168.1.100:8080"
                  disabled={loading}
                  value={serverUrl}
                  onChange={(e) => handleServerUrlChange(e.target.value)}
                />
              </div>
            </div>
          )}

          {errorMsg && <p className="text-xs text-destructive">{errorMsg}</p>}

          <button type="submit" className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/80 disabled:opacity-50" disabled={loading}>
            {loading ? <Loader size={16} className="spin" /> : <span>登录</span>}
          </button>
        </form>

        <div className="mt-5 flex flex-wrap items-center justify-center gap-1.5">
          <button
            className={`rounded-full border px-3 py-1 text-xs font-sans transition-colors flex items-center gap-1 ${theme.themeName === 'quiet-paper' ? 'border-primary text-primary bg-accent' : 'border-border text-muted-foreground bg-transparent'}`}
            onClick={() => theme.setTheme('quiet-paper')}
          >暖纸</button>
          <button
            className={`rounded-full border px-3 py-1 text-xs font-sans transition-colors flex items-center gap-1 ${theme.themeName === 'clean-slate' ? 'border-primary text-primary bg-accent' : 'border-border text-muted-foreground bg-transparent'}`}
            onClick={() => theme.setTheme('clean-slate')}
          >清冷</button>
          <span className="mx-1 h-4 w-px bg-border" />
          <button className="rounded-full border border-border bg-transparent px-3 py-1 text-xs text-muted-foreground font-sans transition-colors flex items-center gap-1" onClick={toggleMode}>
            {theme.resolvedMode === 'light' ? <Sun size={14} /> : <Moon size={14} />}
          </button>
        </div>
      </div>
    </div>
  )
}
