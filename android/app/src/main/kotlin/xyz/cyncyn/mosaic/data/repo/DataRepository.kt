package xyz.cyncyn.mosaic.data.repo

import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import xyz.cyncyn.mosaic.data.api.MosaicApi
import xyz.cyncyn.mosaic.data.auth.TokenStore
import xyz.cyncyn.mosaic.data.model.BotResponse
import xyz.cyncyn.mosaic.data.model.DiaryResponse
import xyz.cyncyn.mosaic.data.model.DiaryWithMemos
import xyz.cyncyn.mosaic.data.model.MemoDetail
import xyz.cyncyn.mosaic.data.model.MemoWithResources
import xyz.cyncyn.mosaic.data.model.ResourceResponse
import xyz.cyncyn.mosaic.data.model.SearchMemosResponse
import xyz.cyncyn.mosaic.data.model.SyncCursors
import xyz.cyncyn.mosaic.data.model.SyncResult
import xyz.cyncyn.mosaic.data.model.TagCount
import xyz.cyncyn.mosaic.data.model.UserResponse
import xyz.cyncyn.mosaic.data.net.AuthException
import xyz.cyncyn.mosaic.data.store.LocalStore
import xyz.cyncyn.mosaic.data.sync.SyncEngine

/**
 * Offline-first facade over api + local store. Screens render the flows and
 * call the suspend actions; the store is always written first-or-after so the
 * UI keeps working without network.
 */
class DataRepository(
    private val api: MosaicApi,
    private val store: LocalStore,
    private val tokenStore: TokenStore,
    private val clientId: String,
) {

    sealed interface AuthState {
        data object Unknown : AuthState
        data class LoggedIn(val user: UserResponse?) : AuthState
        data object LoggedOut : AuthState
    }

    data class AppEvent(
        val id: Long,
        val kind: String,
        val message: String,
        val at: Long,
    )

    private val engine = SyncEngine(api, store, clientId)

    private val _authState = MutableStateFlow<AuthState>(AuthState.Unknown)
    val authState: StateFlow<AuthState> = _authState.asStateFlow()

    private val _memos = MutableStateFlow<List<MemoWithResources>>(emptyList())
    val memos: StateFlow<List<MemoWithResources>> = _memos.asStateFlow()

    private val _diaries = MutableStateFlow<Map<String, DiaryResponse>>(emptyMap())
    val diaries: StateFlow<Map<String, DiaryResponse>> = _diaries.asStateFlow()

    private val _resources = MutableStateFlow<List<ResourceResponse>>(emptyList())
    val resources: StateFlow<List<ResourceResponse>> = _resources.asStateFlow()

    private val _bots = MutableStateFlow<List<BotResponse>>(emptyList())
    val bots: StateFlow<List<BotResponse>> = _bots.asStateFlow()

    private val _events = MutableStateFlow<List<AppEvent>>(emptyList())
    val events: StateFlow<List<AppEvent>> = _events.asStateFlow()

    private val _lastSyncAt = MutableStateFlow<Long?>(null)
    val lastSyncAt: StateFlow<Long?> = _lastSyncAt.asStateFlow()

    private val _cursors = MutableStateFlow<SyncCursors?>(null)
    val cursors: StateFlow<SyncCursors?> = _cursors.asStateFlow()

    private val _syncing = MutableStateFlow(false)
    val syncing: StateFlow<Boolean> = _syncing.asStateFlow()

    private var eventSeq = System.currentTimeMillis()

    private suspend fun refreshFlows() {
        _memos.value = store.allMemos()
        _diaries.value = store.allDiaries().associateBy { it.date }
        _resources.value = store.allResources()
        _bots.value = store.allBots()
        _cursors.value = store.getCursors()
    }

    private suspend fun addEvent(kind: String, message: String) {
        eventSeq += 1
        _events.value = (listOf(AppEvent(eventSeq, kind, message, System.currentTimeMillis())) + _events.value).take(50)
    }

    /** Load cache into flows and resolve the session (tolerates being offline). */
    suspend fun bootstrap() {
        refreshFlows()
        val tokens = tokenStore.tokens()
        if (tokens == null) {
            _authState.value = AuthState.LoggedOut
            return
        }
        val cachedUser = runCatching { tokenStore.user() }.getOrNull()
        _authState.value = AuthState.LoggedIn(cachedUser)
        runCatching { api.me() }
            .onSuccess { user ->
                tokenStore.saveUser(user)
                _authState.value = AuthState.LoggedIn(user)
            }
    }

    suspend fun syncNow(): SyncResult {
        if (_syncing.value) return SyncResult(pulled = 0, cursors = store.getCursors(), rounds = 0)
        _syncing.value = true
        try {
            val result = runCatching { engine.syncAll() }.getOrElse {
                addEvent("sync", "暂时离线，使用本地缓存")
                return SyncResult(pulled = 0, cursors = store.getCursors(), rounds = 0)
            }
            refreshFlows()
            _lastSyncAt.value = System.currentTimeMillis()
            if (result.pulled > 0) {
                addEvent("sync", "同步完成，拉取 ${result.pulled} 条变更")
            }
            return result
        } finally {
            _syncing.value = false
        }
    }

    suspend fun login(username: String, password: String): UserResponse {
        val response = api.login(username, password)
        tokenStore.save(xyz.cyncyn.mosaic.data.model.AuthTokens(response.accessToken, response.refreshToken))
        response.user?.let { tokenStore.saveUser(it) }
        _authState.value = AuthState.LoggedIn(response.user)
        addEvent("auth", "已登录 ${response.user?.username ?: username}")
        refreshFlows()
        return response.user ?: UserResponse(id = "", username = username)
    }

    suspend fun logout() {
        tokenStore.clear()
        _authState.value = AuthState.LoggedOut
        addEvent("auth", "已退出登录")
    }

    suspend fun createMemo(
        content: String,
        tags: List<String> = emptyList(),
        diaryDate: String? = null,
        resourceIds: List<String> = emptyList(),
    ): MemoWithResources {
        val memo = api.createMemo(content, tags, diaryDate, resourceIds)
        store.upsertMemos(listOf(memo))
        refreshFlows()
        addEvent("memo", "已记录一条 memo")
        return memo
    }

    suspend fun deleteMemo(id: String) {
        api.deleteMemo(id)
        store.deleteMemoIds(listOf(id))
        refreshFlows()
        addEvent("memo", "已删除一条 memo")
    }

    suspend fun updateMemo(id: String, fields: kotlinx.serialization.json.JsonObject): MemoWithResources {
        val memo = api.updateMemo(id, fields)
        store.upsertMemos(listOf(memo))
        refreshFlows()
        return memo
    }

    suspend fun setMemoArchived(id: String, archived: Boolean, diaryDate: String? = null): MemoWithResources {
        val memo = if (archived) api.archiveMemo(id, diaryDate) else api.unarchiveMemo(id)
        store.upsertMemos(listOf(memo))
        refreshFlows()
        return memo
    }

    suspend fun memoDetail(id: String): MemoDetail? = runCatching {
        api.getMemoDetail(id)
    }.getOrElse { e ->
        store.getMemo(id)?.let { local ->
            MemoDetail(memo = local, revisions = emptyList(), botReplies = emptyList())
        } ?: throw e
    }

    suspend fun search(
        query: String,
        tags: List<String> = emptyList(),
        startDate: String? = null,
        endDate: String? = null,
        isArchived: Boolean? = null,
    ): SearchMemosResponse = runCatching {
        api.searchMemos(query, tags, startDate, endDate, isArchived)
    }.getOrElse { e ->
        // offline fallback: filter the local cache
        if (e is AuthException) throw e
        val local = store.allMemos()
            .filter { query.isEmpty() || it.content.contains(query) || it.tags.any { t -> t.contains(query) } }
            .filter { tags.isEmpty() || tags.all { t -> it.tags.contains(t) } }
            .filter { startDate == null || epochDate(it.createdAt) >= startDate }
            .filter { endDate == null || epochDate(it.createdAt) <= endDate }
            .filter { isArchived == null || it.isArchived == isArchived }
        SearchMemosResponse(memos = local, total = local.size, semanticEnabled = false)
    }

    private fun epochDate(epochMs: Long): String =
        java.time.Instant.ofEpochMilli(epochMs).toString().take(10)

    suspend fun tags(): List<TagCount> = runCatching { api.tags() }.getOrElse {
        _memos.value.flatMap { it.tags }.groupingBy { it }.eachCount().map { (tag, count) -> TagCount(tag, count) }
    }

    suspend fun diary(date: String): DiaryWithMemos? {
        val remote = runCatching { api.getDiary(date) }.getOrNull()
        if (remote != null) {
            store.upsertDiaries(listOf(DiaryResponse(date = remote.date, summary = remote.summary, moodKey = remote.moodKey, moodScore = remote.moodScore, generationSource = remote.generationSource, autoGenerationLocked = remote.autoGenerationLocked, generatedFromMemoIds = remote.generatedFromMemoIds, lastAutoGeneratedAt = remote.lastAutoGeneratedAt, createdAt = remote.createdAt, updatedAt = remote.updatedAt)))
            refreshFlows()
            return remote
        }
        val cached = store.getDiary(date) ?: return null
        return DiaryWithMemos(date = cached.date, summary = cached.summary, moodKey = cached.moodKey, moodScore = cached.moodScore, generationSource = cached.generationSource, autoGenerationLocked = cached.autoGenerationLocked, generatedFromMemoIds = cached.generatedFromMemoIds, lastAutoGeneratedAt = cached.lastAutoGeneratedAt, createdAt = cached.createdAt, updatedAt = cached.updatedAt, memos = store.allMemos().filter { it.diaryDate == date })
    }

    suspend fun saveDiary(
        date: String,
        summary: String? = null,
        moodKey: String? = null,
        moodScore: Int? = null,
    ): DiaryWithMemos {
        val saved = api.saveDiary(date, summary, moodKey, moodScore)
        store.upsertDiaries(
            listOf(
                DiaryResponse(
                    date = saved.date,
                    summary = saved.summary,
                    moodKey = saved.moodKey,
                    moodScore = saved.moodScore,
                    generationSource = saved.generationSource,
                    autoGenerationLocked = saved.autoGenerationLocked,
                    generatedFromMemoIds = saved.generatedFromMemoIds,
                    lastAutoGeneratedAt = saved.lastAutoGeneratedAt,
                    createdAt = saved.createdAt,
                    updatedAt = saved.updatedAt,
                ),
            ),
        )
        refreshFlows()
        return saved
    }

    suspend fun setBotAutoReply(id: String, enabled: Boolean): BotResponse {
        val bot = api.updateBot(
            id,
            kotlinx.serialization.json.JsonObject(mapOf("autoReply" to kotlinx.serialization.json.JsonPrimitive(enabled))),
        )
        store.upsertBots(listOf(bot))
        refreshFlows()
        return bot
    }

    suspend fun heatmap(startDate: String, endDate: String) = runCatching { api.heatmap(startDate, endDate) }.getOrNull()

    suspend fun clearCache() {
        store.updateCursors(SyncCursors.EMPTY)
        store.deleteMemoIds(store.allMemos().map { it.id })
        store.deleteDiaryIds(store.allDiaries().map { it.date })
        store.deleteResourceIds(store.allResources().map { it.id })
        store.deleteBotIds(store.allBots().map { it.id })
        refreshFlows()
        addEvent("cache", "本地缓存已清空")
    }
}
