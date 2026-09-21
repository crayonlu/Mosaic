package xyz.cyncyn.mosaic.data.store

import java.io.File
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import kotlinx.serialization.builtins.ListSerializer
import xyz.cyncyn.mosaic.data.model.BotResponse
import xyz.cyncyn.mosaic.data.model.DiaryResponse
import xyz.cyncyn.mosaic.data.model.MemoWithResources
import xyz.cyncyn.mosaic.data.model.ResourceResponse
import xyz.cyncyn.mosaic.data.model.SyncCursors
import xyz.cyncyn.mosaic.data.net.MosaicJson

/**
 * File-backed store: snapshots each entity list to JSON in [dir], surviving
 * process death. Writes are atomic (tmp file + rename).
 */
class FileLocalStore(private val dir: File) : LocalStore {

    private val mutex = Mutex()
    private val delegate = InMemoryLocalStore()
    private var loaded = false

    private suspend fun ensureLoaded() = mutex.withLock {
        if (loaded) return@withLock
        withContext(Dispatchers.IO) {
            dir.mkdirs()
            readJson(dir.resolve("memos.json"), ListSerializer(MemoWithResources.serializer()))?.let {
                delegate.upsertMemos(it)
            }
            readJson(dir.resolve("diaries.json"), ListSerializer(DiaryResponse.serializer()))?.let {
                delegate.upsertDiaries(it)
            }
            readJson(dir.resolve("resources.json"), ListSerializer(ResourceResponse.serializer()))?.let {
                delegate.upsertResources(it)
            }
            readJson(dir.resolve("bots.json"), ListSerializer(BotResponse.serializer()))?.let {
                delegate.upsertBots(it)
            }
            readJson(dir.resolve("cursors.json"), SyncCursors.serializer())?.let {
                delegate.updateCursors(it)
            }
            loaded = true
        }
    }

    private inline fun <reified T> readJson(file: File, serializer: kotlinx.serialization.KSerializer<T>): T? =
        runCatching {
            if (!file.exists()) return@runCatching null
            MosaicJson.decodeFromString(serializer, file.readText())
        }.getOrNull()

    private suspend fun persist(name: String, content: String) = withContext(Dispatchers.IO) {
        dir.mkdirs()
        val target = dir.resolve(name)
        val tmp = dir.resolve("$name.tmp")
        tmp.writeText(content)
        if (!tmp.renameTo(target)) {
            target.delete()
            tmp.renameTo(target)
        }
    }

    override suspend fun getCursors(): SyncCursors {
        ensureLoaded()
        return delegate.getCursors()
    }

    override suspend fun updateCursors(cursors: SyncCursors) {
        ensureLoaded()
        delegate.updateCursors(cursors)
        persist("cursors.json", MosaicJson.encodeToString(SyncCursors.serializer(), cursors))
    }

    override suspend fun upsertMemos(items: List<MemoWithResources>) {
        ensureLoaded()
        delegate.upsertMemos(items)
        persist("memos.json", MosaicJson.encodeToString(ListSerializer(MemoWithResources.serializer()), delegate.allMemos()))
    }

    override suspend fun deleteMemoIds(ids: List<String>) {
        ensureLoaded()
        delegate.deleteMemoIds(ids)
        persist("memos.json", MosaicJson.encodeToString(ListSerializer(MemoWithResources.serializer()), delegate.allMemos()))
    }

    override suspend fun allMemos(): List<MemoWithResources> {
        ensureLoaded()
        return delegate.allMemos()
    }

    override suspend fun getMemo(id: String): MemoWithResources? {
        ensureLoaded()
        return delegate.getMemo(id)
    }

    override suspend fun upsertDiaries(items: List<DiaryResponse>) {
        ensureLoaded()
        delegate.upsertDiaries(items)
        persist("diaries.json", MosaicJson.encodeToString(ListSerializer(DiaryResponse.serializer()), delegate.allDiaries()))
    }

    override suspend fun deleteDiaryIds(ids: List<String>) {
        ensureLoaded()
        delegate.deleteDiaryIds(ids)
        persist("diaries.json", MosaicJson.encodeToString(ListSerializer(DiaryResponse.serializer()), delegate.allDiaries()))
    }

    override suspend fun allDiaries(): List<DiaryResponse> {
        ensureLoaded()
        return delegate.allDiaries()
    }

    override suspend fun getDiary(date: String): DiaryResponse? {
        ensureLoaded()
        return delegate.getDiary(date)
    }

    override suspend fun upsertResources(items: List<ResourceResponse>) {
        ensureLoaded()
        delegate.upsertResources(items)
        persist("resources.json", MosaicJson.encodeToString(ListSerializer(ResourceResponse.serializer()), delegate.allResources()))
    }

    override suspend fun deleteResourceIds(ids: List<String>) {
        ensureLoaded()
        delegate.deleteResourceIds(ids)
        persist("resources.json", MosaicJson.encodeToString(ListSerializer(ResourceResponse.serializer()), delegate.allResources()))
    }

    override suspend fun allResources(): List<ResourceResponse> {
        ensureLoaded()
        return delegate.allResources()
    }

    override suspend fun upsertBots(items: List<BotResponse>) {
        ensureLoaded()
        delegate.upsertBots(items)
        persist("bots.json", MosaicJson.encodeToString(ListSerializer(BotResponse.serializer()), delegate.allBots()))
    }

    override suspend fun deleteBotIds(ids: List<String>) {
        ensureLoaded()
        delegate.deleteBotIds(ids)
        persist("bots.json", MosaicJson.encodeToString(ListSerializer(BotResponse.serializer()), delegate.allBots()))
    }

    override suspend fun allBots(): List<BotResponse> {
        ensureLoaded()
        return delegate.allBots()
    }
}
