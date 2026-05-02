import { apiClient } from '@mosaic/api'
import type { SyncApiAdapter, SyncPullRequest, SyncPullResponse } from '@mosaic/sync'

export function createMobileSyncApiAdapter(): SyncApiAdapter {
  return {
    async pull(request: SyncPullRequest): Promise<SyncPullResponse> {
      console.log('[Sync][apiAdapter] POST /api/sync/pull, request:', JSON.stringify(request))
      try {
        const res = await apiClient.post<SyncPullResponse>('/api/sync/pull', request)
        console.log('[Sync][apiAdapter] pull response ok')
        return res
      } catch (e: any) {
        console.error('[Sync][apiAdapter] pull error:', e?.message ?? e, 'status:', e?.status ?? e?.statusCode, 'response:', e?.response ?? e?.body)
        throw e
      }
    },
  }
}
