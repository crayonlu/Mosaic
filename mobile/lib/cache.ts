import { getBearerAuthHeaders } from '@/lib/services/apiAuth';
import {
  getResourceLoader,
  MobilePlatformAdapter,
  setPlatformAdapter,
  type ResourceLoader,
} from '@mosaic/cache';

let resourceLoader: ResourceLoader | null = null

export const initializeMobileCache = async (): Promise<ResourceLoader> => {
  if (!resourceLoader) {
    const adapter = new MobilePlatformAdapter()
    adapter.setAuthHeaderProvider(getBearerAuthHeaders)

    setPlatformAdapter(adapter)
    resourceLoader = await getResourceLoader()
  }
  return resourceLoader
}

export const getMobileResourceLoader = (): ResourceLoader | null => {
  return resourceLoader
}
