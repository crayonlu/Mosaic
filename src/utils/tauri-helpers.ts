import { appDataDir, join } from '@tauri-apps/api/path'

export async function getAssetsDir(): Promise<string> {
  const dataDir = await appDataDir()
  return await join(dataDir, 'assets')
}

