import { SidebarTrigger } from '@/components/ui/sidebar'
import { useTime } from '@/hooks/use-time'
import { minimizeWindow, toggleMaximize, closeWindow, isMaximized } from '@/utils/window-controls'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { Minimize, Maximize, Minimize2, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useUserStore } from '@/stores/user-store'

export function CustomTitleBar() {
  const { greeting, formattedDateWithWeek } = useTime()
  const { user } = useUserStore()
  const [maximized, setMaximized] = useState(false)

  async function checkMaximized() {
    const maximizedState = await isMaximized()
    setMaximized(maximizedState)
  }

  useEffect(() => {
    checkMaximized()

    const window = getCurrentWindow()
    let unlistenFn: (() => void) | null = null

    window
      .onResized(() => {
        checkMaximized()
      })
      .then(fn => {
        unlistenFn = fn
      })

    return () => {
      if (unlistenFn) {
        unlistenFn()
      }
    }
  }, [])

  async function handleMaximize() {
    await toggleMaximize()
    await checkMaximized()
  }

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

      <div className="flex items-center gap-2 titlebar-no-drag">
        <div className="text-sm text-gray-500 mr-2">{formattedDateWithWeek}</div>
        <button
          onClick={minimizeWindow}
          className="h-8 w-8 flex items-center justify-center hover:bg-muted rounded transition-colors"
          aria-label="最小化"
        >
          <Minimize className="h-4 w-4" />
        </button>
        <button
          onClick={handleMaximize}
          className="h-8 w-8 flex items-center justify-center hover:bg-muted rounded transition-colors"
          aria-label={maximized ? '还原' : '最大化'}
        >
          {maximized ? <Minimize2 className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
        </button>
        <button
          onClick={closeWindow}
          className="h-8 w-8 flex items-center justify-center hover:bg-muted rounded transition-colors"
          aria-label="关闭"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </header>
  )
}
