import { PenBox, Inbox, Search, Settings, User as UserIcon, Moon, Sun } from 'lucide-react'
import { useLocation, Link } from 'react-router-dom'
import { useEffect } from 'react'
import { useTheme } from '@/hooks/use-theme'
import { useUserStore } from '@/stores/user-store'
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  SidebarRail,
} from '@/components/ui/sidebar'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { useAvatarUrl } from '@/utils/avatar-helpers'
import { SidebarHeatMap } from '@/components/desktop/SidebarHeatMap'
import LightMosaicIcon from '@/assets/mosaic-light.svg'
import DarkMosaicIcon from '@/assets/mosaic-dark.svg'

const items = [
  { title: '记录', url: '/', icon: PenBox },
  { title: '归档', url: '/archive', icon: Inbox },
  { title: '搜索', url: '/search', icon: Search },
]

export function AppSidebar() {
  const location = useLocation()
  const { user, loadUser } = useUserStore()
  const { theme, toggleTheme } = useTheme()
  const avatarUrl = useAvatarUrl(user?.avatarPath, user?.avatarUrl)

  useEffect(() => {
    if (!user) {
      loadUser()
    }
  }, [])
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu className="flex flex-row items-center justify-between">
          <SidebarMenuItem className="group-data-[collapsible=icon]:hidden">
            <SidebarMenuButton asChild className="hover:bg-transparent hover:text-inherit">
              <Link to="/">
                <div className="leading-none text-primary/80">
                  <img src={theme === 'dark' ? DarkMosaicIcon : LightMosaicIcon} alt="Mosaic" className="size-16" />
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={(e) => toggleTheme(e)}
              tooltip={theme === 'dark' ? '切换到浅色模式' : '切换到深色模式'}
              className="hover:bg-primary/5 hover:text-primary transition-all"
            >
              {theme === 'dark' ? <Sun className="size-4" /> : <Moon className="size-4" />}
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent className="flex flex-col justify-between">
        <SidebarGroup>
          <SidebarGroupLabel>Welcome to Mosaic, {user?.username || 'new user'}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map(item => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={location.pathname === item.url}
                    tooltip={item.title}
                    className="hover:bg-primary/5 transition-all"
                  >
                    <Link to={item.url}>
                      <item.icon />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup className='group-data-[collapsible=icon]:hidden'>
          <SidebarGroupContent>
            <SidebarHeatMap />
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem className="flex items-center justify-between">
            <SidebarMenuButton
              size="lg"
              className="hover:bg-transparent hover:text-primary transition-all w-auto"
            >
              <Avatar className="h-8 w-8 rounded-lg">
                <AvatarImage src={avatarUrl} alt={user?.username || 'User'} />
                <AvatarFallback>
                  <UserIcon className="size-4" />
                </AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">{user?.username || 'new user'}</span>
              </div>
            </SidebarMenuButton>
            <Link
              to="/settings"
              className="flex items-center gap-1 hover:text-primary hover:bg-primary/10 p-2 rounded-md transition-all"
            >
              <Settings className="size-5" />
            </Link>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  )
}
