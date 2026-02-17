import { tokenStorage } from './token-storage'

export async function getBearerAuthHeaders(): Promise<Record<string, string>> {
  const token = await tokenStorage.getAccessToken()

  if (!token) {
    return {}
  }

  return {
    Authorization: `Bearer ${token}`,
  }
}
