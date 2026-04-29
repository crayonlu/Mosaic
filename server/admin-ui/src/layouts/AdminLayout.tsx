import { ChevronDown, LogOut, Moon, Snowflake, Sun, User } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, Outlet } from 'react-router-dom'
import { useAuthStore } from '../stores/authStore'
import { useThemeStore } from '../stores/themeStore'

export default function AdminLayout() {
  const auth = useAuthStore()
  const themeStore = useThemeStore()
  const [menuOpen, setMenuOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('click', onClick)
    return () => document.removeEventListener('click', onClick)
  }, [])

  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 0)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  function handleLogout() {
    setMenuOpen(false)
    auth.logout()
    window.location.href = '/admin/login'
  }

  function toggleMode() {
    themeStore.setMode(themeStore.resolvedMode === 'dark' ? 'light' : 'dark')
  }

  const modeLabel = themeStore.resolvedMode === 'dark' ? '切换浅色模式' : '切换深色模式'

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header
        className={`sticky top-0 z-[100] bg-background transition-colors ${scrolled ? 'border-b border-border' : 'border-b border-transparent'}`}
      >
        <div className="mx-auto flex h-[52px] max-w-[1200px] items-center justify-between px-3 sm:px-6">
          <Link to="/dashboard" className="flex items-center gap-2 font-bold text-base text-primary no-underline tracking-[-0.3px]">
            <svg className="size-[22px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <rect x={3} y={3} width={7} height={7} rx={1.5} />
              <rect x={14} y={3} width={7} height={7} rx={1.5} />
              <rect x={3} y={14} width={7} height={7} rx={1.5} />
              <rect x={14} y={14} width={7} height={7} rx={1.5} />
            </svg>
            <span>Mosaic</span>
          </Link>

          <div className="flex items-center gap-1.5 sm:gap-2">
            <div className="flex items-center gap-0.5 rounded-full bg-card p-0.5">
              <button
                className={`flex size-8 items-center justify-center rounded-full border-none bg-transparent text-muted-foreground transition-colors cursor-pointer sm:size-[30px] ${themeStore.themeName === 'quiet-paper' ? 'bg-accent text-accent-foreground' : ''}`}
                onClick={() => themeStore.setTheme('quiet-paper')}
                title="暖纸主题"
              >
                <Sun size={14} />
              </button>
              <button
                className={`flex size-8 items-center justify-center rounded-full border-none bg-transparent text-muted-foreground transition-colors cursor-pointer sm:size-[30px] ${themeStore.themeName === 'clean-slate' ? 'bg-accent text-accent-foreground' : ''}`}
                onClick={() => themeStore.setTheme('clean-slate')}
                title="清冷主题"
              >
                <Snowflake size={14} />
              </button>
              <span className="mx-0.5 h-4 w-px bg-border" />
              <button className="flex size-8 items-center justify-center rounded-full border-none bg-transparent text-muted-foreground transition-colors cursor-pointer sm:size-[30px]" onClick={toggleMode} title={modeLabel}>
                {themeStore.resolvedMode === 'dark' ? <Moon size={14} /> : <Sun size={14} />}
              </button>
            </div>

            <div ref={menuRef} className="relative">
              <button
                className="flex items-center gap-1 rounded-full border-none bg-card px-2.5 py-1.5 text-[13px] text-foreground font-sans transition-colors cursor-pointer sm:gap-1.5 sm:px-3"
                onClick={() => setMenuOpen(!menuOpen)}
              >
                <User size={16} />
                <span className="hidden max-w-[100px] overflow-hidden text-ellipsis whitespace-nowrap sm:inline">{auth.user?.username || '用户'}</span>
                <ChevronDown size={12} className={`text-muted-foreground transition-transform ${menuOpen ? 'rotate-180' : ''}`} />
              </button>
              {menuOpen && (
                <div className="absolute right-0 top-[calc(100%+4px)] min-w-[140px] rounded-lg bg-card p-1 shadow-lg border border-border">
                  <button
                    className="flex w-full items-center gap-2 rounded-md border-none bg-transparent px-3 py-2 text-[13px] text-foreground font-sans transition-colors cursor-pointer hover:bg-muted"
                    onClick={handleLogout}
                  >
                    <LogOut size={14} />
                    退出登录
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 px-3 pb-8 sm:px-6 sm:pb-12">
        <Outlet />
      </main>
    </div>
  )
}
