import { MoodHeatMap } from '@/components/common/MoodHeatMap'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { useTheme } from '@/hooks/use-theme'
import { useStatsStore } from '@/stores/stats-store'
import { useUserStore } from '@/stores/user-store'
import { Inbox, Moon, PenBox, Search, Sun } from 'lucide-react'
import { useEffect } from 'react'

interface SidebarProps {
  activeTab: string
  onTabChange: (tab: string) => void
  onLogout: () => void
}

const navItems = [
  { id: 'memos', title: '记录', icon: PenBox },
  { id: 'archive', title: '归档', icon: Inbox },
  { id: 'search', title: '搜索', icon: Search },
]

export function Sidebar({ activeTab, onTabChange, onLogout }: SidebarProps) {
  const { user, loadUser } = useUserStore()
  const { heatmapData, loadHeatmap } = useStatsStore()
  const { theme, toggleTheme } = useTheme()

  useEffect(() => {
    if (!user) {
      loadUser()
    }
    loadHeatmap()
  }, [])

  return (
    <div className="w-64 h-screen bg-card border-r flex flex-col">
      <div className="p-4 border-b">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold">Mosaic</h1>
          <Button variant="ghost" size="icon" onClick={toggleTheme} className="h-8 w-8">
            {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          Welcome, {user?.username || 'new user'}
        </p>
      </div>

      <nav className="flex-1 p-4">
        <div className="space-y-1">
          {navItems.map(item => (
            <Button
              key={item.id}
              variant={activeTab === item.id ? 'secondary' : 'ghost'}
              className="w-full justify-start gap-2"
              onClick={() => onTabChange(item.id)}
            >
              <item.icon className="h-4 w-4" />
              {item.title}
            </Button>
          ))}
        </div>

        {heatmapData && (
          <div className="mt-8">
            <h3 className="text-sm font-medium mb-3">心情热力图</h3>
            <MoodHeatMap data={heatmapData} />
          </div>
        )}
      </nav>

      <div className="p-4 border-t">
        <div className="flex items-center gap-3 mb-3">
          <Avatar className="h-8 w-8">
            <AvatarFallback>{user?.username?.[0].toUpperCase()}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{user?.username}</p>
          </div>
        </div>
        <Button variant="outline" className="w-full" onClick={onLogout}>
          退出登录
        </Button>
      </div>
    </div>
  )
}
