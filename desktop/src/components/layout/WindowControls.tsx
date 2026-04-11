import { hideWindow, isMaximized, minimizeWindow, toggleMaximize } from '@/utils/windowControls'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { Maximize, Minimize, Minimize2, X } from 'lucide-react'
import { useEffect, useState } from 'react'

export function WindowControls() {
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
    <div className="flex items-center gap-2 titlebar-no-drag">
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
        onClick={hideWindow}
        className="h-8 w-8 flex items-center justify-center hover:bg-muted rounded transition-colors"
        aria-label="关闭"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}
