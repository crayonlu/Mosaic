import {
  Bot,
  ChevronDown,
  LayoutDashboard,
  LogOut,
  Palette,
  User,
  Users,
} from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { Link, Outlet, useLocation } from "react-router-dom"
import i18n from "../lib/i18n"
import { useAuthStore } from "../stores/authStore"
import { useThemeStore } from "../stores/themeStore"

function NavLink({
  to,
  icon: Icon,
  label,
  active,
}: {
  to: string
  icon: React.FC<{ size?: number; className?: string }>
  label: string
  active: boolean
}) {
  return (
    <Link
      to={to}
      className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[13px] font-medium no-underline transition-colors ${
        active
          ? "bg-muted text-foreground"
          : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
      }`}
    >
      <Icon size={14} />
      <span className="hidden sm:inline">{label}</span>
    </Link>
  )
}

export default function AdminLayout() {
  const { t } = useTranslation()
  const auth = useAuthStore()
  const themeStore = useThemeStore()
  const location = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  const isAdmin = auth.user?.role === "admin"

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener("click", onClick)
    return () => document.removeEventListener("click", onClick)
  }, [])

  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 0)
    }
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  function handleLogout() {
    setMenuOpen(false)
    auth.logout()
    window.location.href = "/admin/login"
  }

  function toggleTheme() {
    themeStore.setThemeName(
      themeStore.themeName === "quietPaper" ? "cleanSlate" : "quietPaper"
    )
  }

  function toggleLanguage() {
    const next = i18n.language === "zh" ? "en" : "zh"
    i18n.changeLanguage(next)
    localStorage.setItem("admin-ui-locale", next)
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header
        className={`sticky top-0 z-100 bg-background transition-colors ${scrolled ? "border-b border-border" : "border-b border-transparent"}`}
      >
        <div className="mx-auto flex h-11 max-w-300 items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-4">
            <Link
              to="/dashboard"
              className="flex items-center gap-2 text-base font-bold tracking-[-0.3px] text-primary no-underline"
            >
              <svg
                className="size-5"
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
              <span>Mosaic</span>
            </Link>

            <nav className="flex items-center gap-1">
              <NavLink
                to="/dashboard"
                icon={LayoutDashboard}
                label={t("layout.dashboard")}
                active={location.pathname === "/dashboard"}
              />
              <NavLink
                to="/bots"
                icon={Bot}
                label={t("layout.bots")}
                active={location.pathname === "/bots"}
              />
              {isAdmin && (
                <NavLink
                  to="/users"
                  icon={Users}
                  label={t("layout.users")}
                  active={location.pathname === "/users"}
                />
              )}
            </nav>
          </div>

          <div className="flex items-center gap-2">
            <button
              className="flex size-7 items-center justify-center rounded-md border-none bg-transparent text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              onClick={toggleLanguage}
              title={t("layout.switchLanguage")}
            >
              {i18n.language === "zh"
                ? t("layout.languageEn")
                : t("layout.languageZh")}
            </button>

            <button
              className="flex size-7 items-center justify-center rounded-md border-none bg-transparent text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              onClick={toggleTheme}
              title={
                themeStore.themeName === "quietPaper"
                  ? t("layout.themeCleanSlate")
                  : t("layout.themeQuietPaper")
              }
            >
              <Palette size={15} />
            </button>

            <div ref={menuRef} className="relative">
              <button
                className="flex items-center gap-1.5 rounded-md border border-border bg-transparent px-2.5 py-1.5 font-sans text-[13px] text-foreground transition-colors hover:bg-muted"
                onClick={() => setMenuOpen(!menuOpen)}
              >
                <User size={14} className="text-muted-foreground" />
                <span className="hidden max-w-25 overflow-hidden text-ellipsis whitespace-nowrap sm:inline">
                  {auth.user?.username || t("layout.user")}
                </span>
                <ChevronDown
                  size={12}
                  className={`text-muted-foreground transition-transform ${menuOpen ? "rotate-180" : ""}`}
                />
              </button>
              {menuOpen && (
                <div className="absolute top-[calc(100%+4px)] right-0 min-w-35 rounded-lg border border-border bg-card p-1 shadow-lg">
                  <button
                    className="flex w-full items-center gap-2 rounded-md border-none bg-transparent px-3 py-2 font-sans text-[13px] text-foreground transition-colors hover:bg-muted"
                    onClick={handleLogout}
                  >
                    <LogOut size={14} />
                    {t("layout.logout")}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 px-4 pb-10 sm:px-6 sm:pb-14">
        <Outlet />
      </main>
    </div>
  )
}
