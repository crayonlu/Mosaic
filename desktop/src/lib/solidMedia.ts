import { apiClient } from '@mosaic/api'
import { core } from 'solid-media'
import 'solid-media'

let configured = false

export function ensureSolidMediaConfigured(): void {
  if (configured) return

  core.setFetcher(async url => {
    if (url.startsWith('blob:') || url.startsWith('data:')) {
      const response = await fetch(url)
      if (!response.ok) {
        throw new Error(`Failed to load local media: HTTP ${response.status}`)
      }
      return response.blob()
    }

    const token = await apiClient.getTokenStorage()?.getAccessToken()
    const response = await fetch(url, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })

    if (!response.ok) {
      const error = new Error(`Failed to load media: HTTP ${response.status}`)
      Object.assign(error, { status: response.status })
      throw error
    }

    return response.blob()
  })

  configured = true
}

ensureSolidMediaConfigured()

export { core as solidMediaCore }
