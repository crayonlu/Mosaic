import { useAppStore } from '@/stores/app-store'

export function useSidebar() {
  const sidebarOpen = useAppStore(state => state.sidebarOpen)
  const setSidebarOpen = useAppStore(state => state.setSidebarOpen)
  const toggleSidebar = useAppStore(state => state.toggleSidebar)

  return {
    sidebarOpen,
    setSidebarOpen,
    toggleSidebar,
  }
}
