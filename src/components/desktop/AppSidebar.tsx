import { Calendar, PenBox, Inbox, Search, Settings, User as UserIcon } from "lucide-react"
import { useLocation, Link } from "react-router-dom"
import { useEffect, useState } from "react"
import { userCommands } from "@/utils/callRust"
import type { User } from "@/types/user"
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
} from "@/components/ui/sidebar"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import Icon from "@/assets/icon.png"

const items = [
  { title: "记录", url: "/", icon: PenBox },
  { title: "回顾", url: "/inbox", icon: Inbox },
  { title: "日历", url: "/calendar", icon: Calendar },
  { title: "搜索", url: "/search", icon: Search },
]

export function AppSidebar() {
  const location = useLocation()
  const [user, setUser] = useState<User | null>(null)

  useEffect(() => {
    userCommands.getUser().then(setUser).catch(console.error)
  }, [])
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link to="/">
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg text-sidebar-primary-foreground">
                  <img src={Icon} alt="Mosaic" className="size-8" />
                </div>
                <div className="leading-none text-primary/80">
                  <span className="font-bold">Mosaic</span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Welcome to Mosaic, {user?.username || "new user"}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton 
                    asChild 
                    isActive={location.pathname === item.url}
                    tooltip={item.title}
                    className="hover:bg-primary/5 hover:text-primary transition-all"
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
        
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem className="flex items-center justify-between">
            <SidebarMenuButton size="lg" className="hover:bg-transparent hover:text-inherit">
              <Avatar className="h-8 w-8 rounded-lg">
                <AvatarImage src={user?.avatarUrl} alt="Crayon" />
                <AvatarFallback><UserIcon className="size-4" /></AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">{user?.username || "new user"}</span>
              </div>
            </SidebarMenuButton>
            <Link to="/settings" className="flex items-center gap-1 hover:text-primary hover:bg-primary/10 p-2 rounded-md transition-all">
              <Settings className="size-5" />
            </Link>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  )
}