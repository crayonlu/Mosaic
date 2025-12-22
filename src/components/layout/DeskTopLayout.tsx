import { SidebarProvider, SidebarTrigger, SidebarInset } from '@/components/ui/sidebar'
import { AppSidebar } from '@/components/desktop/AppSidebar'
import { useSidebar } from '@/hooks/use-sidebar'
import { useTime } from '@/hooks/use-time'
import { userCommands } from '@/utils/callRust'
import { useEffect, useState } from 'react'

export default function Layout({ children }: { children: React.ReactNode }) {
  const { sidebarOpen, setSidebarOpen } = useSidebar()
  const { greeting, formattedDateWithWeek } = useTime()
  const [username, setUsername] = useState('')

  useEffect(() => {
    userCommands.getUser().then(user => setUsername(user?.username || '')).catch(console.error)
  }, [])
  return (
    <SidebarProvider open={sidebarOpen} onOpenChange={setSidebarOpen} defaultOpen={sidebarOpen}>
      <AppSidebar />
      <SidebarInset className='h-screen overflow-hidden'>
        <header className="flex h-12 shrink-0 items-center justify-between border-b px-4">
          <div className='flex items-center gap-2'>
            <SidebarTrigger className="-ml-1 hover:text-primary hover:bg-primary/10 p-2 rounded-md transition-all" />
            <div className="text-sm text-gray-500">
              {greeting}
              {username ? '，' + username : ''}
            </div>
          </div>
          <div className='text-sm text-gray-500'>
            {formattedDateWithWeek}
          </div>
        </header>
        <div className="flex-1 p-4 h-[calc(100dvh-3rem)] overflow-y-auto">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  )
}
