package xyz.cyncyn.mosaic.data.net

import okhttp3.HttpUrl.Companion.toHttpUrl
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody

/** Base URL is resolved per request so the setup screen can retarget the server. */
class OkHttpTransport(
    private val client: OkHttpClient,
    private val baseUrlProvider: () -> String,
) : HttpTransport {

    override suspend fun execute(request: ApiRequest): ApiResponse = kotlinx.coroutines.withContext(kotlinx.coroutines.Dispatchers.IO) {
        val base = baseUrlProvider().toHttpUrl()
        val url = base.newBuilder().apply {
            encodedPath(base.encodedPath.trimEnd('/') + "/" + request.path.trimStart('/'))
            for ((key, value) in request.query) {
                if (value != null) addQueryParameter(key, value)
            }
        }.build()

        val body = request.body?.toRequestBody("application/json; charset=utf-8".toMediaType())
        val builder = Request.Builder().url(url).method(request.method, body)
        for ((name, value) in request.headers) builder.header(name, value)

        client.newCall(builder.build()).execute().use { response ->
            val bytes = response.body?.bytes() ?: ByteArray(0)
            val headers = response.headers.toMap()
            ApiResponse(response.code, bytes, headers)
        }
    }
}
