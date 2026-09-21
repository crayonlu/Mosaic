package xyz.cyncyn.mosaic.data.auth

import xyz.cyncyn.mosaic.data.model.AuthTokens
import xyz.cyncyn.mosaic.data.model.UserResponse

interface TokenStore {
    suspend fun tokens(): AuthTokens?
    suspend fun save(tokens: AuthTokens)
    suspend fun clear()
    suspend fun saveUser(user: UserResponse) {}
    suspend fun user(): UserResponse? = null
}
