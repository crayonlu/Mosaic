import type { SyncCursors, SyncStoreAdapter } from '@mosaic/sync'
import {
  applyPulledDiaries,
  applyPulledMemos,
  applyPulledResources,
  getSyncCursors,
  upsertSyncCursor,
} from '../storage/repositories'

export function createMobileSyncStoreAdapter(): SyncStoreAdapter {
  async function getCursors(): Promise<SyncCursors> {
    return getSyncCursors()
  }

  async function updateCursors(cursors: SyncCursors): Promise<void> {
    for (const [entityType, lastSyncAt] of Object.entries(cursors)) {
      await upsertSyncCursor(entityType, lastSyncAt as number)
    }
  }

  async function clearLocalData(): Promise<void> {
    // noop — sync cursors are kept for incremental pull
  }

  async function applyChanges(changes: {
    memo?: { updated: Record<string, unknown>[]; deletedIds: string[] }
    diary?: { updated: Record<string, unknown>[]; deletedIds: string[] }
    resource?: { updated: Record<string, unknown>[]; deletedIds: string[] }
  }): Promise<void> {
    if (changes.memo) {
      await applyPulledMemos(changes.memo.updated, changes.memo.deletedIds)
    }
    if (changes.diary) {
      await applyPulledDiaries(changes.diary.updated, changes.diary.deletedIds)
    }
    if (changes.resource) {
      await applyPulledResources(changes.resource.updated, changes.resource.deletedIds)
    }
  }

  return { getCursors, updateCursors, clearLocalData, applyChanges }
}
