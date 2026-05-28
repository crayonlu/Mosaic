import { File, Paths } from 'expo-file-system'
import * as IntentLauncher from 'expo-intent-launcher'
import Constants from 'expo-constants'
import { Platform } from 'react-native'

const GITHUB_RELEASES_URL = 'https://api.github.com/repos/crayonlu/Mosaic/releases/latest'

export interface ReleaseInfo {
  version: string
  tagName: string
  downloadUrl: string
  releaseNotes: string
  publishedAt: string
  fileSize?: number
}

/**
 * Get current app version from expo config
 */
export function getCurrentVersion(): string {
  return Constants.expoConfig?.version ?? '0.0.0'
}

/**
 * Compare two semver strings. Returns true if remote > local.
 */
export function isNewerVersion(remote: string, local: string): boolean {
  const remoteParts = remote.split('.').map(Number)
  const localParts = local.split('.').map(Number)

  for (let i = 0; i < 3; i++) {
    const r = remoteParts[i] ?? 0
    const l = localParts[i] ?? 0
    if (r > l) return true
    if (r < l) return false
  }
  return false
}

/**
 * Check GitHub Releases for the latest version
 */
export async function checkLatestRelease(): Promise<ReleaseInfo | null> {
  try {
    const response = await fetch(GITHUB_RELEASES_URL, {
      headers: { Accept: 'application/vnd.github.v3+json' },
    })

    if (!response.ok) {
      console.warn('[appUpdate] GitHub API responded with', response.status)
      return null
    }

    const data = await response.json()
    const tagName: string = data.tag_name ?? ''
    const version = tagName.replace(/^v/, '')

    // Find APK asset
    const apkAsset = (data.assets ?? []).find((asset: any) => asset.name?.endsWith('.apk'))

    if (!apkAsset) {
      console.warn('[appUpdate] No APK asset found in release')
      return null
    }

    return {
      version,
      tagName,
      downloadUrl: apkAsset.browser_download_url,
      releaseNotes: data.body ?? '',
      publishedAt: data.published_at ?? '',
      fileSize: apkAsset.size,
    }
  } catch (error) {
    console.warn('[appUpdate] Failed to check release:', error)
    return null
  }
}

/**
 * Download APK to local filesystem with real progress tracking
 * Uses fetch + ReadableStream to report download progress
 */
export async function downloadApk(
  url: string,
  onProgress?: (percent: number) => void
): Promise<File> {
  const destination = new File(Paths.cache, 'mosaic-update.apk')

  // Delete old file if exists
  try {
    if (destination.exists) {
      destination.delete()
    }
  } catch {}

  // Fetch with streaming to track progress
  const response = await fetch(url, {
    headers: { Accept: 'application/octet-stream' },
  })

  if (!response.ok) {
    throw new Error(`Download failed: HTTP ${response.status}`)
  }

  const contentLength = Number(response.headers.get('content-length') || 0)
  const reader = response.body?.getReader()

  if (!reader) {
    // Fallback: no streaming support, download without progress
    const blob = await response.blob()
    const arrayBuffer = await blob.arrayBuffer()
    destination.write(new Uint8Array(arrayBuffer))
    onProgress?.(100)
    return destination
  }

  // Stream download with progress
  const chunks: Uint8Array[] = []
  let receivedBytes = 0

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    chunks.push(value)
    receivedBytes += value.byteLength

    if (contentLength > 0) {
      const percent = Math.round((receivedBytes / contentLength) * 100)
      onProgress?.(percent)
    }
  }

  // Combine chunks and write to file
  const fullBuffer = new Uint8Array(receivedBytes)
  let offset = 0
  for (const chunk of chunks) {
    fullBuffer.set(chunk, offset)
    offset += chunk.byteLength
  }

  destination.write(fullBuffer)
  onProgress?.(100)

  return destination
}

/**
 * Install APK using Android intent.
 * Uses File.contentUri for proper FileProvider permissions on Android 7+.
 */
export async function installApk(file: File): Promise<void> {
  if (Platform.OS !== 'android') return

  await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
    data: file.contentUri,
    flags: 1, // FLAG_GRANT_READ_URI_PERMISSION
    type: 'application/vnd.android.package-archive',
  })
}
