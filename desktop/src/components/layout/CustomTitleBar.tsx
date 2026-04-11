import { SidebarTrigger } from '@/components/ui/sidebar'
import { useTime } from '@/hooks/useTime'
import { useUser } from '@mosaic/api'
import { WindowControls } from './WindowControls'

export function CustomTitleBar() {
  const { greeting, formattedDateWithWeek } = useTime()
  const { data: user } = useUser()

  return (
    <header className="flex h-12 shrink-0 items-center justify-between border-b px-4 titlebar-drag">
      <div className="flex items-center gap-2 titlebar-no-drag">
        <SidebarTrigger className="-ml-1 hover:text-primary hover:bg-primary/10 p-2 rounded-md transition-all" />
        <div className="text-sm text-gray-500">
          {greeting}
          {user?.username ? '，' + user.username : ''}
        </div>
      </div>

      <div className="flex-1 titlebar-drag" />

      <div className="flex items-center gap-2">
        <div className="text-sm text-gray-500 mr-2">{formattedDateWithWeek}</div>
        <WindowControls />
      </div>
    </header>
  )
}
