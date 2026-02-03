import { useEffect } from 'react'
import { useConnectionStore } from '../stores/connection-store'

export function useConnection() {
  const { isConnected, isServerReachable, initialize, cleanup } = useConnectionStore()

  useEffect(() => {
    initialize()
    return cleanup
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return {
    isConnected,
    isServerReachable,
    canUseNetwork: isConnected && isServerReachable,
  }
}
