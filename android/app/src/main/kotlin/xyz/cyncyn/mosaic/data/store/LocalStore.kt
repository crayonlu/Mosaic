package xyz.cyncyn.mosaic.data.store

import xyz.cyncyn.mosaic.data.model.BotResponse
import xyz.cyncyn.mosaic.data.model.DiaryResponse
import xyz.cyncyn.mosaic.data.model.MemoWithResources
import xyz.cyncyn.mosaic.data.model.ResourceResponse
import xyz.cyncyn.mosaic.data.model.SyncCursors

/**
 * Offline cache contract. Implementations must survive process death
 * (the app uses the file-backed [FileLocalStore]; tests use [InMemoryLocalStore]).
 */
interface LocalStore {
    suspend fun getCursors(): SyncCursors
    suspend fun updateCursors(cursors: SyncCursors)

    suspend fun upsertMemos(items: List<MemoWithResources>)
    suspend fun deleteMemoIds(ids: List<String>)
    suspend fun allMemos(): List<MemoWithResources>
    suspend fun getMemo(id: String): MemoWithResources?

    suspend fun upsertDiaries(items: List<DiaryResponse>)
    suspend fun deleteDiaryIds(ids: List<String>)
    suspend fun allDiaries(): List<DiaryResponse>
    suspend fun getDiary(date: String): DiaryResponse?

    suspend fun upsertResources(items: List<ResourceResponse>)
    suspend fun deleteResourceIds(ids: List<String>)
    suspend fun allResources(): List<ResourceResponse>

    suspend fun upsertBots(items: List<BotResponse>)
    suspend fun deleteBotIds(ids: List<String>)
    suspend fun allBots(): List<BotResponse>
}

class InMemoryLocalStore : LocalStore {
    private var cursors = SyncCursors.EMPTY
    private val memos = LinkedHashMap<String, MemoWithResources>()
    private val diaries = LinkedHashMap<String, DiaryResponse>()
    private val resources = LinkedHashMap<String, ResourceResponse>()
    private val bots = LinkedHashMap<String, BotResponse>()

    override suspend fun getCursors(): SyncCursors = cursors

    override suspend fun updateCursors(cursors: SyncCursors) {
        this.cursors = cursors
    }

    override suspend fun upsertMemos(items: List<MemoWithResources>) {
        for (item in items) memos[item.id] = item
    }

    override suspend fun deleteMemoIds(ids: List<String>) {
        for (id in ids) memos.remove(id)
    }

    override suspend fun allMemos(): List<MemoWithResources> = memos.values.sortedByDescending { it.createdAt }

    override suspend fun getMemo(id: String): MemoWithResources? = memos[id]

    override suspend fun upsertDiaries(items: List<DiaryResponse>) {
        for (item in items) diaries[item.date] = item
    }

    override suspend fun deleteDiaryIds(ids: List<String>) {
        for (id in ids) diaries.remove(id)
    }

    override suspend fun allDiaries(): List<DiaryResponse> = diaries.values.sortedByDescending { it.date }

    override suspend fun getDiary(date: String): DiaryResponse? = diaries[date]

    override suspend fun upsertResources(items: List<ResourceResponse>) {
        for (item in items) resources[item.id] = item
    }

    override suspend fun deleteResourceIds(ids: List<String>) {
        for (id in ids) resources.remove(id)
    }

    override suspend fun allResources(): List<ResourceResponse> = resources.values.sortedByDescending { it.createdAt }

    override suspend fun upsertBots(items: List<BotResponse>) {
        for (item in items) bots[item.id] = item
    }

    override suspend fun deleteBotIds(ids: List<String>) {
        for (id in ids) bots.remove(id)
    }

    override suspend fun allBots(): List<BotResponse> = bots.values.sortedBy { it.sortOrder }
}
