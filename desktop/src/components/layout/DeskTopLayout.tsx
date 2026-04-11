import { AppSidebar } from '@/components/desktop/AppSidebar'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { useSidebar } from '@/hooks/useSidebar'
import { Outlet } from 'react-router-dom'
import { CustomTitleBar } from './CustomTitleBar'

export default function Layout({
  children,
  className,
}: {
  children?: React.ReactNode
  className?: string
}) {
  const { sidebarOpen, setSidebarOpen } = useSidebar()

  return (
    <SidebarProvider open={sidebarOpen} onOpenChange={setSidebarOpen} defaultOpen={sidebarOpen}>
      <AppSidebar />
      <SidebarInset className="h-screen overflow-hidden">
        <CustomTitleBar />
        <div className={`flex-1 p-4 h-[calc(100dvh-3rem)] overflow-y-auto ${className}`}>
          {children ?? <Outlet />}
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
