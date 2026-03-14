import {
  getResourceLoader,
  MobilePlatformAdapter,
  setPlatformAdapter,
  type ResourceLoader,
} from '@mosaic/cache'

let resourceLoader: ResourceLoader | null = null

export const initializeMobileCache = async (): Promise<ResourceLoader> => {
  const adapter = new MobilePlatformAdapter()
  setPlatformAdapter(adapter)
  resourceLoader = await getResourceLoader()
  return resourceLoader
}

export const getMobileResourceLoader = (): ResourceLoader | null => {
  return resourceLoader
}
