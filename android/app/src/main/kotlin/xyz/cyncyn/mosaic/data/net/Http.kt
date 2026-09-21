package xyz.cyncyn.mosaic.data.net

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive

val MosaicJson: Json = Json {
    ignoreUnknownKeys = true
    explicitNulls = false
    encodeDefaults = false
}

/** Mutable JSON builder instance that writes explicit nulls (for clearing fields). */
val MosaicJsonWithNulls: Json = Json {
    ignoreUnknownKeys = true
    encodeDefaults = true
}

class ApiRequest(
    val method: String,
    val path: String,
    val query: List<Pair<String, String?>> = emptyList(),
    val headers: Map<String, String> = emptyMap(),
    val body: ByteArray? = null,
) {
    fun header(name: String, value: String): ApiRequest =
        ApiRequest(method, path, query, headers + (name to value), body)

    fun bodyUtf8(): String? = body?.toString(Charsets.UTF_8)
}

class ApiResponse(
    val status: Int,
    val body: ByteArray,
    val headers: Map<String, String> = emptyMap(),
) {
    fun bodyUtf8(): String = body.toString(Charsets.UTF_8)
}

class HttpException(
    val status: Int,
    val errorBody: String?,
) : Exception("HTTP $status: ${errorBody?.take(200)}") {
    /** Contract error body: {"error": "...", "message": "..."} */
    val message2: String? by lazy {
        runCatching {
            MosaicJson.parseToJsonElement(errorBody ?: "").jsonObject["message"]?.jsonPrimitive?.content
        }.getOrNull()
    }
}

class AuthException(message: String) : Exception(message)

fun interface HttpTransport {
    suspend fun execute(request: ApiRequest): ApiResponse
}
