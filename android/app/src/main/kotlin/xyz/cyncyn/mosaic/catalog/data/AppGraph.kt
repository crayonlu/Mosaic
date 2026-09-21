package xyz.cyncyn.mosaic.catalog.data

import android.content.Context
import android.content.SharedPreferences
import java.util.UUID
import okhttp3.OkHttpClient
import xyz.cyncyn.mosaic.data.api.MosaicApi
import xyz.cyncyn.mosaic.data.auth.AuthedTransport
import xyz.cyncyn.mosaic.data.auth.TokenStore
import xyz.cyncyn.mosaic.data.model.AuthTokens
import xyz.cyncyn.mosaic.data.model.UserResponse
import xyz.cyncyn.mosaic.data.net.OkHttpTransport
import xyz.cyncyn.mosaic.data.repo.DataRepository
import xyz.cyncyn.mosaic.data.store.FileLocalStore
import java.io.File
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import android.graphics.BitmapFactory
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.asImageBitmap
import kotlinx.coroutines.runBlocking
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import xyz.cyncyn.mosaic.data.net.MosaicJson
import java.util.concurrent.TimeUnit

/** Server URL + theme preference persistence (setup screen writes these). */
class ConnectionStore(private val prefs: SharedPreferences) {

    var baseUrl: String
        get() = prefs.getString(KEY_BASE_URL, null) ?: DEFAULT_BASE_URL
        set(value) = prefs.edit().putString(KEY_BASE_URL, value.trimEnd('/')).apply()

    /** "system" | "light" | "dark" — persisted through ThemeController */
    var themeMode: String
        get() = prefs.getString(KEY_THEME_MODE, null) ?: "system"
        set(value) = prefs.edit().putString(KEY_THEME_MODE, value).apply()

    /** Resource URLs from the contract are server-relative; make them absolute. */
    fun absoluteUrl(path: String): String =
        if (path.startsWith("http")) path else baseUrl.trimEnd('/') + path

    fun absolutePath(path: String): String = absoluteUrl(path)

    companion object {
        // Emulator loopback to the host machine (contract stub / dev server).
        const val DEFAULT_BASE_URL = "http://10.0.2.2:18080"
        private const val KEY_BASE_URL = "base_url"
        private const val KEY_THEME_MODE = "theme_mode"
    }
}

class AndroidTokenStore(private val prefs: SharedPreferences) : TokenStore {

    override suspend fun tokens(): AuthTokens? {
        val access = prefs.getString(KEY_ACCESS, null) ?: return null
        val refresh = prefs.getString(KEY_REFRESH, null) ?: return null
        return AuthTokens(access, refresh)
    }

    override suspend fun save(tokens: AuthTokens) {
        prefs.edit()
            .putString(KEY_ACCESS, tokens.accessToken)
            .putString(KEY_REFRESH, tokens.refreshToken)
            .apply()
    }

    override suspend fun clear() {
        prefs.edit().remove(KEY_ACCESS).remove(KEY_REFRESH).remove(KEY_USER).apply()
    }

    override suspend fun saveUser(user: UserResponse) {
        prefs.edit().putString(KEY_USER, xyz.cyncyn.mosaic.data.net.MosaicJson.encodeToString(UserResponse.serializer(), user)).apply()
    }

    override suspend fun user(): UserResponse? = prefs.getString(KEY_USER, null)?.let { text ->
        runCatching { xyz.cyncyn.mosaic.data.net.MosaicJson.decodeFromString(UserResponse.serializer(), text) }.getOrNull()
    }

    private companion object {
        const val KEY_ACCESS = "access_token"
        const val KEY_REFRESH = "refresh_token"
        const val KEY_USER = "user_json"
    }
}

/** Theme mode (外观 page writes it; shell reads it reactively). */
class ThemeController(connection: ConnectionStore) {
    private val _mode = kotlinx.coroutines.flow.MutableStateFlow(connection.themeMode)
    val mode: kotlinx.coroutines.flow.StateFlow<String> = _mode
    fun set(mode: String) {
        _mode.value = mode
    }
}

/** Manual dependency graph, created once per process. */
class AppGraph(context: Context) {

    private val prefs = context.getSharedPreferences("mosaic_android", Context.MODE_PRIVATE)

    val connection = ConnectionStore(prefs)
    val theme = ThemeController(connection)
    val tokenStore = AndroidTokenStore(prefs)

    private val client = OkHttpClient.Builder()
        .connectTimeout(10, TimeUnit.SECONDS)
        .readTimeout(30, TimeUnit.SECONDS)
        .build()

    private val transport = AuthedTransport(
        OkHttpTransport(client) { connection.baseUrl },
        tokenStore,
    )

    val api = MosaicApi(transport)

    val store = FileLocalStore(File(context.filesDir, "cache"))

    private val clientId: String =
        prefs.getString(KEY_CLIENT_ID, null) ?: UUID.randomUUID().toString().also {
            prefs.edit().putString(KEY_CLIENT_ID, it).apply()
        }

    val repository = DataRepository(api, store, tokenStore, clientId)

    /** multipart 资源上传（share 分享图片用），返回可引用的 resource id。 */
    suspend fun uploadResource(bytes: ByteArray, filename: String, mimeType: String): String =
        kotlinx.coroutines.withContext(kotlinx.coroutines.Dispatchers.IO) {
            val token = kotlinx.coroutines.runBlocking { tokenStore.tokens()?.accessToken }
            val body = okhttp3.MultipartBody.Builder()
                .setType(okhttp3.MultipartBody.FORM)
                .addFormDataPart(
                    "file",
                    filename,
                    okhttp3.RequestBody.create(mimeType.toMediaTypeOrNull(), bytes),
                )
                .build()
            val request = okhttp3.Request.Builder()
                .url(connection.baseUrl.trimEnd('/') + "/api/resources/upload")
                .post(body)
                .apply { token?.let { header("Authorization", "Bearer $it") } }
                .build()
            client.newCall(request).execute().use { response ->
                val text = response.body?.string() ?: ""
                check(response.isSuccessful) { "upload failed: ${response.code}" }
                MosaicJson
                    .decodeFromString(xyz.cyncyn.mosaic.data.model.ResourceResponse.serializer(), text)
                    .id
            }
        }

    /** Authenticated raw fetch for resource files (images render via detail page). */
    suspend fun fetchResourceBitmap(path: String): ImageBitmap? = withContext(Dispatchers.IO) {
        runCatching {
            val bytes = transport.execute(xyz.cyncyn.mosaic.data.net.ApiRequest("GET", path)).body
            BitmapFactory.decodeByteArray(bytes, 0, bytes.size).asImageBitmap()
        }.getOrNull()
    }


    private companion object {
        const val KEY_CLIENT_ID = "client_id"
    }
}
