import { Outlet } from 'react-router-dom'
import { WindowControls } from './WindowControls'

function SetupWindowTitleBar() {
  return (
    <header className="flex h-12 shrink-0 items-center justify-between border-b px-4 titlebar-drag">
      <div className="text-sm text-muted-foreground">Mosaic</div>
      <div className="flex-1 titlebar-drag" />
      <WindowControls />
    </header>
  )
}

export default function SetupLayout() {
  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <SetupWindowTitleBar />
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  )
}
