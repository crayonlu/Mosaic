/**
 * Mosaic MCP server configuration and authentication.
 *
 * Uses the shared @mosaic/api client (Node entry, no React hooks) so the
 * MCP server and the mobile app stay on the same HTTP/type layer.
 *
 * Environment variables:
 *   MOSAIC_SERVER_URL  - URL of the Mosaic backend (required)
 *   MOSAIC_TOKEN       - JWT access token (alternative to credentials)
 *   MOSAIC_USERNAME    - Username (used with MOSAIC_PASSWORD if no token)
 *   MOSAIC_PASSWORD    - Password (used with MOSAIC_USERNAME if no token)
 */
import { apiClient, authApi, type TokenStorage } from '@mosaic/api/node'

export interface MosaicConfig {
  serverUrl: string
  token?: string
  username?: string
  password?: string
}

class MemoryTokenStorage implements TokenStorage {
  private accessToken: string | null = null
  private refreshToken: string | null = null

  async getAccessToken(): Promise<string | null> {
    return this.accessToken
  }

  async getRefreshToken(): Promise<string | null> {
    return this.refreshToken
  }

  async setTokens(accessToken: string, refreshToken: string): Promise<void> {
    this.accessToken = accessToken
    this.refreshToken = refreshToken
  }

  async clearTokens(): Promise<void> {
    this.accessToken = null
    this.refreshToken = null
  }
}

export function getConfig(): MosaicConfig {
  const serverUrl = process.env.MOSAIC_SERVER_URL
  if (!serverUrl) {
    throw new Error(
      'MOSAIC_SERVER_URL environment variable is required (e.g. http://localhost:8080)'
    )
  }

  return {
    serverUrl,
    token: process.env.MOSAIC_TOKEN,
    username: process.env.MOSAIC_USERNAME,
    password: process.env.MOSAIC_PASSWORD,
  }
}

/**
 * Configure the shared API client with the server URL and credentials.
 * With MOSAIC_TOKEN the token is used as-is; with username/password the
 * server logs in and stores both tokens so refresh happens automatically.
 */
export async function setupApiClient(config: MosaicConfig): Promise<void> {
  apiClient.setBaseUrl(config.serverUrl)
  const storage = new MemoryTokenStorage()
  apiClient.setTokenStorage(storage)
  apiClient.onAuthFailed = () => {
    console.error('WARNING: Authentication failed. Token may be invalid or expired.')
  }

  if (config.token) {
    await storage.setTokens(config.token, '')
    return
  }

  if (!config.username || !config.password) {
    throw new Error(
      'No authentication configured. Provide MOSAIC_TOKEN or MOSAIC_USERNAME + MOSAIC_PASSWORD.'
    )
  }

  const login = await authApi.login({ username: config.username, password: config.password })
  await storage.setTokens(login.accessToken, login.refreshToken)
}
