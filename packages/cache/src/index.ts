export * from './abstract';
export * from './hooks/useResourceCache';
export * from './implementations/memoryCache';
export * from './implementations/realmCache';
export * from './implementations/tauriCache';
export * from './platform/adapter';
export * from './platform/mobileAdapter';
export * from './platform/tauriAdapter';
export * from './services/resourceLoader';
export * from './types';
export * from './utils/hash';
export * from './utils/policy';

import { MemoryCacheManager } from './implementations/memoryCache';
import { RealmCacheManager } from './implementations/realmCache';
import { TauriCacheManager } from './implementations/tauriCache';
import type { CacheConfig, ICacheManager, Platform } from './types';
import { DEFAULT_CACHE_CONFIG } from './types';

export const createCacheManager = (platform: Platform): ICacheManager => {
  switch (platform) {
    case 'desktop':
      return new TauriCacheManager();
    case 'mobile':
      return new RealmCacheManager();
    case 'web':
      return new MemoryCacheManager();
    default:
      throw new Error(`Unsupported platform: ${platform}`);
  }
};

export const createCacheManagerWithConfig = async (
  platform: Platform,
  config?: Partial<CacheConfig>
): Promise<ICacheManager> => {
  const fullConfig = { ...DEFAULT_CACHE_CONFIG[platform], ...config };
  const manager = createCacheManager(platform);
  await manager.initialize(fullConfig);
  return manager;
};

export const detectPlatformFromUA = (): Platform => {
  if (typeof window === 'undefined') return 'web';
  if ('__TAURI__' in window) return 'desktop';
  const userAgent = navigator.userAgent.toLowerCase();
  if (/android|iphone|ipad|ipod|mobile/i.test(userAgent)) return 'mobile';
  return 'web';
};

export const createAutoCacheManager = async (
  config?: Partial<CacheConfig>
): Promise<ICacheManager> => {
  const platform = detectPlatformFromUA();
  return createCacheManagerWithConfig(platform, config);
};

import { ResourceLoader } from './services/resourceLoader';

let resourceLoaderInstance: ResourceLoader | null = null;

export const createResourceLoader = async (): Promise<ResourceLoader> => {
  if (!resourceLoaderInstance) {
    resourceLoaderInstance = new ResourceLoader();
    await resourceLoaderInstance.initialize();
  }
  return resourceLoaderInstance;
};

export { ResourceLoader };

// Aliases for backward compatibility
export { detectPlatformFromUA as detectPlatform, createResourceLoader as getResourceLoader };
