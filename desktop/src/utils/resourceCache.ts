import {
  getResourceLoader,
  setPlatformAdapter,
  TauriPlatformAdapter,
  type ResourceLoader,
} from '@mosaic/cache'

let resourceLoader: ResourceLoader | null = null

const initLoader = async (): Promise<ResourceLoader> => {
  if (!resourceLoader) {
    const adapter = new TauriPlatformAdapter()

    adapter.setAuthHeaderProvider(async (): Promise<Record<string, string>> => {
      const token = localStorage.getItem('auth_token')
      if (!token) return {}
      return { Authorization: `Bearer ${token}` }
    })

    setPlatformAdapter(adapter)
    resourceLoader = await getResourceLoader()
  }
  return resourceLoader
}

export async function getCachedResource(
  src: string,
  _type: 'images' | 'videos'
): Promise<string | null> {
  const loader = await initLoader()
  const isCached = await loader.isCached(src)
  if (!isCached) return null

  const metadata = await loader.getCachedMetadata(src)
  if (!metadata) return null

  return metadata.localPath
}

export async function setCachedResource(
  src: string,
  _blob: Blob,
  _type: 'images' | 'videos'
): Promise<void> {
  const loader = await initLoader()
  await loader.load(src, {
    forceRefresh: true,
    allowCache: true,
  })
}

export async function clearCache(_type?: 'images' | 'videos'): Promise<void> {
  const loader = await initLoader()
  await loader.clearCache()
}

export async function getCacheCount(_type: 'images' | 'videos'): Promise<number> {
  const loader = await initLoader()
  const usage = await loader.getCacheUsage()
  return usage?.itemCount ?? 0
}

export async function getCacheSize(_type: 'images' | 'videos'): Promise<number> {
  const loader = await initLoader()
  const usage = await loader.getCacheUsage()
  return usage?.totalSize ?? 0
}

export async function clearAllCache(): Promise<void> {
  const loader = await initLoader()
  await loader.clearCache()
}
