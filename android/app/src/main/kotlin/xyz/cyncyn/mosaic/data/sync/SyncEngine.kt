package xyz.cyncyn.mosaic.data.sync

import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import xyz.cyncyn.mosaic.data.api.MosaicApi
import xyz.cyncyn.mosaic.data.model.EntityChanges
import xyz.cyncyn.mosaic.data.model.SyncCursors
import xyz.cyncyn.mosaic.data.model.SyncResult
import xyz.cyncyn.mosaic.data.store.LocalStore

/**
 * Cursor-based pull sync, ported from packages/sync semantics and upgraded:
 * loops until the server reports no further changes (contract caps each pull
 * at 200 changes per entity).
 */
class SyncEngine(
    private val api: MosaicApi,
    private val store: LocalStore,
    private val clientId: String,
) {

    private val mutex = Mutex()

    /** Single pull → apply → cursor advance. */
    suspend fun syncOnce(): xyz.cyncyn.mosaic.data.model.SyncResult = mutex.withLock {
        val cursors = store.getCursors()
        val pull = api.syncPull(clientId, cursors)
        applyChanges(pull.changes)
        val merged = mergeCursors(cursors, pull.cursors)
        store.updateCursors(merged)
        SyncResult(pulled = pull.changes.totalChanges, cursors = merged, rounds = 1)
    }

    /** Repeated [syncOnce] until the incremental pull is empty. */
    suspend fun syncAll(maxRounds: Int = 20): SyncResult {
        var total = 0
        var rounds = 0
        var cursors = store.getCursors()
        while (rounds < maxRounds) {
            val result = syncOnce()
            rounds += 1
            total += result.pulled
            cursors = result.cursors
            if (result.pulled == 0) break
        }
        return SyncResult(pulled = total, cursors = cursors, rounds = rounds)
    }

    suspend fun applyChanges(changes: xyz.cyncyn.mosaic.data.model.SyncEntityChanges) {
        if (changes.memo.updated.isNotEmpty() || changes.memo.deletedIds.isNotEmpty()) {
            store.upsertMemos(changes.memo.updated)
            store.deleteMemoIds(changes.memo.deletedIds)
        }
        if (changes.diary.updated.isNotEmpty() || changes.diary.deletedIds.isNotEmpty()) {
            store.upsertDiaries(changes.diary.updated)
            store.deleteDiaryIds(changes.diary.deletedIds)
        }
        if (changes.resource.updated.isNotEmpty() || changes.resource.deletedIds.isNotEmpty()) {
            store.upsertResources(changes.resource.updated)
            store.deleteResourceIds(changes.resource.deletedIds)
        }
        if (changes.bot.updated.isNotEmpty() || changes.bot.deletedIds.isNotEmpty()) {
            store.upsertBots(changes.bot.updated)
            store.deleteBotIds(changes.bot.deletedIds)
        }
    }

    private fun mergeCursors(local: SyncCursors, remote: SyncCursors): SyncCursors = SyncCursors(
        memo = maxOfOrNull(local.memo, remote.memo),
        diary = maxOfOrNull(local.diary, remote.diary),
        resource = maxOfOrNull(local.resource, remote.resource),
        bot = maxOfOrNull(local.bot, remote.bot),
    )
}

private fun <T : Comparable<T>> maxOfOrNull(a: T?, b: T?): T? =
    listOfNotNull(a, b).maxOrNull()

suspend fun EntityChanges<*>.isEmpty(): Boolean = updated.isEmpty() && deletedIds.isEmpty()
