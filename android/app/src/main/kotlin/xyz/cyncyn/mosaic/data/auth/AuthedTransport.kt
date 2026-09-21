package xyz.cyncyn.mosaic.data.auth

import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.JsonObject
import xyz.cyncyn.mosaic.data.model.AuthTokens
import xyz.cyncyn.mosaic.data.net.ApiRequest
import xyz.cyncyn.mosaic.data.net.AuthException
import xyz.cyncyn.mosaic.data.net.HttpTransport
import xyz.cyncyn.mosaic.data.net.MosaicJson

/**
 * Transport decorator: attaches the bearer token, and on 401 refreshes once
 * (single-flight) then retries. Auth endpoints pass through untouched.
 */
class AuthedTransport(
    private val inner: HttpTransport,
    private val tokenStore: TokenStore,
) : HttpTransport {

    private val refreshMutex = Mutex()

    override suspend fun execute(request: ApiRequest): xyz.cyncyn.mosaic.data.net.ApiResponse {
        val token = tokenStore.tokens()?.accessToken
        val authed = if (token != null && !isAuthEndpoint(request.path)) {
            request.header("Authorization", "Bearer $token")
        } else {
            request
        }
        val response = inner.execute(authed)
        if (response.status != 401 || isAuthEndpoint(request.path) || token == null) {
            return response
        }

        val newToken = refreshMutex.withLock {
            val current = tokenStore.tokens()?.accessToken
            if (current != null && current != token) {
                // another caller already refreshed while we waited
                current
            } else {
                performRefresh(tokenStore.tokens()?.refreshToken) ?: throwAuth()
            }
        }
        val retry = inner.execute(request.header("Authorization", "Bearer $newToken"))
        if (retry.status == 401) throwAuth()
        return retry
    }

    private suspend fun performRefresh(refreshToken: String?): String? {
        if (refreshToken == null) return null
        val response = inner.execute(
            ApiRequest(
                method = "POST",
                path = "/api/auth/refresh",
                headers = mapOf("Content-Type" to "application/json; charset=utf-8"),
                body = MosaicJson.encodeToString(
                    JsonObject(mapOf("refreshToken" to JsonPrimitive(refreshToken))),
                ).toByteArray(),
            ),
        )
        if (response.status != 200) {
            tokenStore.clear()
            return null
        }
        val tokens = runCatching {
            MosaicJson.decodeFromString<AuthTokens>(response.bodyUtf8())
        }.getOrNull() ?: return null
        tokenStore.save(tokens)
        return tokens.accessToken
    }

    private fun throwAuth(): Nothing = throw AuthException("session expired")

    private fun isAuthEndpoint(path: String): Boolean =
        path == "/api/auth/login" || path == "/api/auth/refresh"
}
