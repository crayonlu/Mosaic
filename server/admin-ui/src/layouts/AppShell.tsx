import { Drawer } from "@base-ui/react/drawer"
import {
  CaretDown,
  ChartLine,
  GearSix,
  List,
  Robot,
  SignOut,
  Sun,
  User,
  UserCircle,
  UsersThree,
} from "@phosphor-icons/react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom"
import i18n from "../lib/i18n"
import { cn } from "../lib/utils"
import { useAuthStore } from "../stores/authStore"
import { useThemeStore } from "../stores/themeStore"
import { AppLogo } from "../components/AppLogo"
import { AppMenu } from "../components/ui/menu"
import { AppTooltip } from "../components/ui/tooltip"

const NAV_GROUPS = [
  {
    items: [{ to: "/overview", icon: ChartLine, key: "nav.overview" }],
  },
  {
    key: "nav.groupManage",
    items: [
      { to: "/bots", icon: Robot, key: "nav.bots" },
      { to: "/users", icon: UsersThree, key: "nav.users" },
    ],
  },
  {
    key: "nav.groupSettings",
    items: [
      { to: "/settings/ai", icon: GearSix, key: "nav.aiSettings" },
      { to: "/account", icon: UserCircle, key: "nav.account" },
    ],
  },
]

function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const { t } = useTranslation()
  const isAdmin = useAuthStore((s) => s.user?.role === "admin")
  return (
    <nav className="flex flex-col gap-4 px-3 py-4">
      {NAV_GROUPS.map((group, gi) => (
        <div key={gi} className="flex flex-col gap-0.5">
          {group.key && (
            <p className="px-2.5 pb-1 text-[11px] font-medium tracking-wider text-ink-tertiary uppercase">
              {t(group.key)}
            </p>
          )}
          {group.items
            .filter((item) => item.to !== "/users" || isAdmin)
            .map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={onNavigate}
                className={({ isActive }) =>
                  cn(
                    "flex h-9 items-center gap-2.5 rounded-md px-2.5 text-[13px] font-medium transition-colors",
                    isActive
                      ? "bg-primary-soft text-primary"
                      : "text-ink-secondary hover:bg-subtle hover:text-ink"
                  )
                }
              >
                <item.icon size={16} />
                {t(item.key)}
              </NavLink>
            ))}
        </div>
      ))}
    </nav>
  )
}

function Sidebar() {
  return (
    <aside className="sticky top-0 hidden h-screen w-52 shrink-0 flex-col border-r border-hairline bg-canvas md:flex">
      <Link to="/overview" className="flex h-14 items-center gap-2 px-4">
        <AppLogo className="size-5" />
        <span className="text-[15px] font-semibold tracking-[-0.3px] text-ink">
          Mosaic
        </span>
      </Link>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <SidebarNav />
      </div>
    </aside>
  )
}

function Topbar() {
  const { t } = useTranslation()
  const auth = useAuthStore()
  const theme = useThemeStore()
  const navigate = useNavigate()
  const [drawerOpen, setDrawerOpen] = useState(false)

  const themeLabel =
    theme.preference === "system"
      ? t("nav.themeSystem")
      : theme.preference === "light"
        ? t("nav.themeLight")
        : t("nav.themeDark")

  function toggleLanguage() {
    i18n.changeLanguage(i18n.language === "zh" ? "en" : "zh")
  }

  function handleLogout() {
    auth.logout()
    window.location.href = "/admin/login"
  }

  return (
    <header className="sticky top-0 z-40 flex h-14 items-center justify-between gap-3 border-b border-hairline bg-canvas/90 pr-4 backdrop-blur-sm md:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          className="flex size-[40px] items-center justify-center rounded-md text-ink-secondary transition-colors hover:bg-subtle hover:text-ink md:hidden md:size-8"
          aria-label="Menu"
        >
          <List size={18} />
        </button>
        <Link to="/overview" className="flex items-center gap-2 md:hidden">
          <AppLogo className="size-5" />
          <span className="text-[15px] font-semibold tracking-[-0.3px] text-ink">
            Mosaic
          </span>
        </Link>
      </div>
      <div className="flex items-center gap-1.5">
        <AppTooltip content={t("nav.theme")}>
          <button
            type="button"
            onClick={theme.cycle}
            className="flex size-[40px] items-center justify-center rounded-md text-ink-secondary transition-colors hover:bg-subtle hover:text-ink md:size-8"
            aria-label={themeLabel}
          >
            <Sun size={16} />
          </button>
        </AppTooltip>
        <button
          type="button"
          onClick={toggleLanguage}
          className="flex h-[40px] items-center rounded-md px-2.5 text-xs font-medium text-ink-secondary transition-colors hover:bg-subtle hover:text-ink md:h-8"
          title={t("nav.switchLanguage")}
        >
          {i18n.language === "zh" ? t("nav.languageEn") : t("nav.languageZh")}
        </button>
        <AppMenu
          trigger={
            <span className="flex h-[40px] items-center gap-1.5 rounded-md px-2 text-[13px] font-medium text-ink transition-colors hover:bg-subtle md:h-8">
              <span className="flex size-6 items-center justify-center rounded-full bg-primary-soft text-primary">
                <User size={13} />
              </span>
              <span className="hidden max-w-28 truncate sm:inline">
                {auth.user?.username}
              </span>
              <CaretDown size={11} className="text-ink-tertiary" />
            </span>
          }
          items={[
            {
              key: "account",
              label: t("nav.account"),
              icon: <UserCircle size={15} />,
              onSelect: () => navigate("/account"),
            },
            {
              key: "logout",
              label: t("nav.logout"),
              icon: <SignOut size={15} />,
              danger: true,
              onSelect: handleLogout,
            },
          ]}
        />
      </div>
      <Drawer.Root open={drawerOpen} onOpenChange={setDrawerOpen}>
        <Drawer.Portal>
          <Drawer.Backdrop className="animate-fade-in fixed inset-0 z-50 bg-black/20 backdrop-blur-[2px]" />
          <Drawer.Popup className="fixed inset-y-0 left-0 z-50 w-64 bg-surface shadow-modal md:hidden">
            <div className="flex h-14 items-center gap-2 border-b border-hairline px-4">
              <AppLogo className="size-5" />
              <span className="text-[15px] font-semibold tracking-[-0.3px] text-ink">
                Mosaic
              </span>
            </div>
            <div className="h-[calc(100%-3.5rem)] overflow-y-auto">
              <SidebarNav onNavigate={() => setDrawerOpen(false)} />
            </div>
          </Drawer.Popup>
        </Drawer.Portal>
      </Drawer.Root>
    </header>
  )
}

export default function AppShell() {
  return (
    <div className="flex min-h-screen flex-col bg-canvas md:flex-row">
      <Sidebar />
      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <Topbar />
        <main className="mx-auto w-full max-w-300 flex-1 px-4 py-5 md:px-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
