import { useEffect } from 'react'
import { useConnectionStore } from '../stores/connectionStore'

export function useConnection() {
  const isConnected = useConnectionStore(s => s.isConnected)
  const isServerReachable = useConnectionStore(s => s.isServerReachable)
  const initialize = useConnectionStore(s => s.initialize)
  const cleanup = useConnectionStore(s => s.cleanup)

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
