import { getResourceLoader, setPlatformAdapter, TauriPlatformAdapter, type ResourceLoader } from '@mosaic/cache'

let resourceLoader: ResourceLoader | null = null

export const initializeDesktopCache = async (): Promise<ResourceLoader> => {
  const adapter = new TauriPlatformAdapter()
  setPlatformAdapter(adapter)
  resourceLoader = await getResourceLoader()
  return resourceLoader
}

export const getDesktopResourceLoader = (): ResourceLoader | null => {
  return resourceLoader
}

export const loadResource = async (
  url: string,
  options?: {
    forceRefresh?: boolean
    allowOffline?: boolean
  }
) => {
  if (!resourceLoader) {
    await initializeDesktopCache()
  }
  return resourceLoader!.load(url, options)
}

export const prefetchResources = async (
  urls: string[],
  options?: {
    concurrency?: number
    delayMs?: number
  }
) => {
  if (!resourceLoader) {
    await initializeDesktopCache()
  }
  return resourceLoader!.prefetch(urls, options)
}

export const clearResourceCache = async (): Promise<void> => {
  if (!resourceLoader) {
    await initializeDesktopCache()
  }
  return resourceLoader!.clearCache()
}
