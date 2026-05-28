import { useCallback, useEffect, useState } from 'react'
import { Platform } from 'react-native'
import {
  checkLatestRelease,
  downloadApk,
  getCurrentVersion,
  installApk,
  isNewerVersion,
  type ReleaseInfo,
} from '@/lib/services/appUpdate'

interface AppUpdateState {
  currentVersion: string
  latestVersion: string | null
  hasUpdate: boolean
  releaseInfo: ReleaseInfo | null
  downloadProgress: number | null
  checking: boolean
  downloading: boolean
  error: string | null
}

export function useAppUpdate() {
  const [state, setState] = useState<AppUpdateState>({
    currentVersion: getCurrentVersion(),
    latestVersion: null,
    hasUpdate: false,
    releaseInfo: null,
    downloadProgress: null,
    checking: false,
    downloading: false,
    error: null,
  })

  const checkForUpdate = useCallback(async () => {
    if (Platform.OS !== 'android') return

    setState(prev => ({ ...prev, checking: true, error: null }))

    try {
      const release = await checkLatestRelease()
      if (!release) {
        setState(prev => ({ ...prev, checking: false }))
        return
      }

      const currentVersion = getCurrentVersion()
      const hasUpdate = isNewerVersion(release.version, currentVersion)

      setState(prev => ({
        ...prev,
        checking: false,
        latestVersion: release.version,
        hasUpdate,
        releaseInfo: hasUpdate ? release : null,
      }))
    } catch (error: any) {
      setState(prev => ({
        ...prev,
        checking: false,
        error: error?.message ?? 'Failed to check for updates',
      }))
    }
  }, [])

  const downloadAndInstall = useCallback(async () => {
    const { releaseInfo } = state
    if (!releaseInfo) return

    setState(prev => ({ ...prev, downloading: true, downloadProgress: 0, error: null }))

    try {
      const file = await downloadApk(releaseInfo.downloadUrl, percent => {
        setState(prev => ({ ...prev, downloadProgress: percent }))
      })

      setState(prev => ({ ...prev, downloading: false, downloadProgress: null }))
      await installApk(file)
    } catch (error: any) {
      setState(prev => ({
        ...prev,
        downloading: false,
        downloadProgress: null,
        error: error?.message ?? 'Download failed',
      }))
    }
  }, [state.releaseInfo])

  // Auto-check on mount (Android only)
  useEffect(() => {
    if (Platform.OS === 'android') {
      checkForUpdate()
    }
  }, [checkForUpdate])

  return {
    ...state,
    checkForUpdate,
    downloadAndInstall,
  }
}
