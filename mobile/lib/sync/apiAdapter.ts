import { apiClient } from '@mosaic/api'
import type { SyncApiAdapter, SyncPullRequest, SyncPullResponse } from '@mosaic/sync'

export function createMobileSyncApiAdapter(): SyncApiAdapter {
  return {
    async pull(request: SyncPullRequest): Promise<SyncPullResponse> {
      try {
        const res = await apiClient.post<SyncPullResponse>('/api/sync/pull', request)
        return res
      } catch (e: any) {
        console.error(
          '[Sync][apiAdapter] pull error:',
          e?.message ?? e,
          'status:',
          e?.status ?? e?.statusCode,
          'response:',
          e?.response ?? e?.body
        )
        throw e
      }
    },
  }
}
