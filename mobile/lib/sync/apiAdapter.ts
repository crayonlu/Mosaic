import { apiClient } from '@mosaic/api'
import type { SyncApiAdapter, SyncPullRequest, SyncPullResponse } from '@mosaic/sync'

export function createMobileSyncApiAdapter(): SyncApiAdapter {
  return {
    async pull(request: SyncPullRequest): Promise<SyncPullResponse> {
      return apiClient.post<SyncPullResponse>('/api/sync/pull', request)
    },
  }
}
