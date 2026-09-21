package xyz.cyncyn.mosaic.data.api

import kotlinx.serialization.decodeFromString
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import kotlinx.serialization.builtins.ListSerializer
import xyz.cyncyn.mosaic.data.model.DiaryResponse
import xyz.cyncyn.mosaic.data.model.DiaryWithMemos
import xyz.cyncyn.mosaic.data.model.HeatmapResponse
import xyz.cyncyn.mosaic.data.model.HealthResponse
import xyz.cyncyn.mosaic.data.model.LoginResponse
import xyz.cyncyn.mosaic.data.model.MemoDetail
import xyz.cyncyn.mosaic.data.model.MemoWithResources
import xyz.cyncyn.mosaic.data.model.PaginatedResponse
import xyz.cyncyn.mosaic.data.model.RefreshResponse
import xyz.cyncyn.mosaic.data.model.ResourceResponse
import xyz.cyncyn.mosaic.data.model.BotResponse
import xyz.cyncyn.mosaic.data.model.SearchMemosResponse
import xyz.cyncyn.mosaic.data.model.SyncCursors
import xyz.cyncyn.mosaic.data.model.SyncPullResponse
import xyz.cyncyn.mosaic.data.model.TagCount
import xyz.cyncyn.mosaic.data.model.UserResponse
import xyz.cyncyn.mosaic.data.net.ApiRequest
import xyz.cyncyn.mosaic.data.net.HttpTransport
import xyz.cyncyn.mosaic.data.net.MosaicJson

/**
 * Typed facade over the transport, one method per contract endpoint in
 * docs/server-api.md. Auth headers are added by a wrapping transport.
 */
class MosaicApi(private val transport: HttpTransport) {

    private suspend fun call(request: ApiRequest): xyz.cyncyn.mosaic.data.net.ApiResponse {
        val response = transport.execute(request)
        if (response.status >= 400) throw xyz.cyncyn.mosaic.data.net.HttpException(response.status, response.bodyUtf8())
        return response
    }

    private fun q(vararg entries: Pair<String, Any?>): List<Pair<String, String?>> =
        entries.map { (key, value) -> key to value?.toString() }

    private fun jsonRequest(method: String, path: String, query: List<Pair<String, String?>> = emptyList(), body: JsonObject? = null): ApiRequest =
        ApiRequest(
            method = method,
            path = path,
            query = query,
            headers = if (body != null) mapOf("Content-Type" to "application/json; charset=utf-8") else emptyMap(),
            body = body?.toString()?.toByteArray(),
        )

    // ---- health / auth ----

    suspend fun health(): HealthResponse =
        MosaicJson.decodeFromString(call(jsonRequest("GET", "/health")).bodyUtf8())

    suspend fun login(username: String, password: String): LoginResponse =
        MosaicJson.decodeFromString(
            call(
                jsonRequest(
                    "POST",
                    "/api/auth/login",
                    body = buildJsonObject {
                        put("username", username)
                        put("password", password)
                    },
                ),
            ).bodyUtf8(),
        )

    suspend fun refresh(refreshToken: String): RefreshResponse =
        MosaicJson.decodeFromString(
            call(
                jsonRequest("POST", "/api/auth/refresh", body = buildJsonObject { put("refreshToken", refreshToken) }),
            ).bodyUtf8(),
        )

    suspend fun me(): UserResponse =
        MosaicJson.decodeFromString(call(jsonRequest("GET", "/api/auth/me")).bodyUtf8())

    // ---- memos ----

    suspend fun createMemo(
        content: String,
        tags: List<String> = emptyList(),
        diaryDate: String? = null,
        resourceIds: List<String> = emptyList(),
    ): MemoWithResources =
        MosaicJson.decodeFromString(
            call(
                jsonRequest(
                    "POST",
                    "/api/memos",
                    body = buildJsonObject {
                        put("content", content)
                        put("tags", JsonArray(tags.map { JsonPrimitive(it) }))
                        if (diaryDate != null) put("diaryDate", diaryDate)
                        if (resourceIds.isNotEmpty()) put("resourceIds", JsonArray(resourceIds.map { JsonPrimitive(it) }))
                    },
                ),
            ).bodyUtf8(),
        )

    suspend fun listMemos(
        page: Int = 1,
        pageSize: Int = 20,
        archived: Boolean? = null,
        diaryDate: String? = null,
        search: String? = null,
    ): PaginatedResponse<MemoWithResources> =
        MosaicJson.decodeFromString(
            call(
                jsonRequest(
                    "GET",
                    "/api/memos",
                    query = q(
                        "page" to page,
                        "pageSize" to pageSize,
                        "archived" to archived,
                        "diaryDate" to diaryDate,
                        "search" to search,
                    ),
                ),
            ).bodyUtf8(),
        )

    suspend fun getMemo(id: String): MemoWithResources =
        MosaicJson.decodeFromString(call(jsonRequest("GET", "/api/memos/$id")).bodyUtf8())

    suspend fun getMemoDetail(id: String): MemoDetail =
        MosaicJson.decodeFromString(call(jsonRequest("GET", "/api/memos/$id/detail")).bodyUtf8())

    /** Fields the caller provides are sent; explicit JsonNull values clear server fields. */
    suspend fun updateMemo(id: String, fields: JsonObject): MemoWithResources =
        MosaicJson.decodeFromString(call(jsonRequest("PUT", "/api/memos/$id", body = fields)).bodyUtf8())

    suspend fun deleteMemo(id: String) {
        call(jsonRequest("DELETE", "/api/memos/$id"))
    }

    suspend fun archiveMemo(id: String, diaryDate: String? = null): MemoWithResources =
        MosaicJson.decodeFromString(
            call(
                jsonRequest(
                    "PUT",
                    "/api/memos/$id/archive",
                    body = if (diaryDate != null) buildJsonObject { put("diaryDate", diaryDate) } else null,
                ),
            ).bodyUtf8(),
        )

    suspend fun unarchiveMemo(id: String): MemoWithResources =
        MosaicJson.decodeFromString(call(jsonRequest("PUT", "/api/memos/$id/unarchive")).bodyUtf8())

    suspend fun memosByDate(date: String, archived: Boolean? = null): List<MemoWithResources> =
        MosaicJson.decodeFromString(
            ListSerializer(MemoWithResources.serializer()),
            call(jsonRequest("GET", "/api/memos/date/$date", query = q("archived" to archived))).bodyUtf8(),
        )

    suspend fun searchMemos(
        query: String,
        tags: List<String> = emptyList(),
        startDate: String? = null,
        endDate: String? = null,
        isArchived: Boolean? = null,
        page: Int = 1,
        pageSize: Int = 50,
    ): SearchMemosResponse {
        val queryParams = mutableListOf(
            "query" to query,
            "page" to page.toString(),
            "pageSize" to pageSize.toString(),
            "startDate" to startDate,
            "endDate" to endDate,
            "isArchived" to isArchived?.toString(),
        )
        tags.forEach { queryParams.add("tags[]" to it) }
        return MosaicJson.decodeFromString(
            call(jsonRequest("GET", "/api/memos/search", query = queryParams)).bodyUtf8(),
        )
    }

    suspend fun tags(): List<TagCount> =
        MosaicJson.decodeFromString(
            ListSerializer(TagCount.serializer()),
            call(jsonRequest("GET", "/api/memos/tags")).bodyUtf8(),
        )

    suspend fun memoRevisions(id: String): List<xyz.cyncyn.mosaic.data.model.MemoRevision> =
        MosaicJson.decodeFromString(
            ListSerializer(xyz.cyncyn.mosaic.data.model.MemoRevision.serializer()),
            call(jsonRequest("GET", "/api/memos/$id/revisions")).bodyUtf8(),
        )

    // ---- diaries ----

    suspend fun listDiaries(
        page: Int = 1,
        pageSize: Int = 20,
        startDate: String? = null,
        endDate: String? = null,
    ): PaginatedResponse<DiaryResponse> =
        MosaicJson.decodeFromString(
            call(
                jsonRequest(
                    "GET",
                    "/api/diaries",
                    query = q(
                        "page" to page,
                        "pageSize" to pageSize,
                        "startDate" to startDate,
                        "endDate" to endDate,
                    ),
                ),
            ).bodyUtf8(),
        )

    suspend fun getDiary(date: String): DiaryWithMemos =
        MosaicJson.decodeFromString(call(jsonRequest("GET", "/api/diaries/$date")).bodyUtf8())

    suspend fun saveDiary(
        date: String,
        summary: String? = null,
        moodKey: String? = null,
        moodScore: Int? = null,
    ): DiaryWithMemos {
        val body = buildJsonObject {
            if (summary != null) put("summary", summary)
            if (moodKey != null) put("moodKey", moodKey)
            if (moodScore != null) put("moodScore", moodScore)
        }
        return MosaicJson.decodeFromString(call(jsonRequest("PUT", "/api/diaries/$date", body = body)).bodyUtf8())
    }

    // ---- resources / bots ----

    suspend fun listResources(page: Int = 1, pageSize: Int = 100): PaginatedResponse<ResourceResponse> =
        MosaicJson.decodeFromString(
            call(jsonRequest("GET", "/api/resources", query = q("page" to page, "pageSize" to pageSize))).bodyUtf8(),
        )

    suspend fun listBots(): List<BotResponse> =
        MosaicJson.decodeFromString(
            ListSerializer(BotResponse.serializer()),
            call(jsonRequest("GET", "/api/bots")).bodyUtf8(),
        )

    suspend fun updateBot(id: String, fields: JsonObject): BotResponse =
        MosaicJson.decodeFromString(call(jsonRequest("PUT", "/api/bots/$id", body = fields)).bodyUtf8())

    // ---- sync / stats ----

    suspend fun syncPull(clientId: String, cursors: SyncCursors): SyncPullResponse =
        MosaicJson.decodeFromString(
            call(
                jsonRequest(
                    "POST",
                    "/api/sync/pull",
                    body = buildJsonObject {
                        put("clientId", clientId)
                        put(
                            "cursors",
                            buildJsonObject {
                                cursors.memo?.let { put("memo", it) }
                                cursors.diary?.let { put("diary", it) }
                                cursors.resource?.let { put("resource", it) }
                                cursors.bot?.let { put("bot", it) }
                            },
                        )
                    },
                ),
            ).bodyUtf8(),
        )

    suspend fun heatmap(startDate: String, endDate: String): HeatmapResponse =
        MosaicJson.decodeFromString(
            call(jsonRequest("GET", "/api/stats/heatmap", query = q("startDate" to startDate, "endDate" to endDate))).bodyUtf8(),
        )
}
