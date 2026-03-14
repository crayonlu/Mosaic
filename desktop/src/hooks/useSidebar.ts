import { useAppStore } from '@/stores/appStore'

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
