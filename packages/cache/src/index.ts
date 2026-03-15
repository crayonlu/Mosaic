export * from './abstract';
export * from './hooks/useResourceCache';
export * from './implementations/memoryCache';
export * from './implementations/tauriCache';
export * from './platform/adapter';
export * from './platform/mobileAdapter';
export * from './platform/tauriAdapter';
export * from './services/resourceLoader';
export * from './types';
export * from './utils/hash';
export * from './utils/policy';

export * from './implementations/realmCache';

import { MemoryCacheManager } from './implementations/memoryCache';
import { TauriCacheManager } from './implementations/tauriCache';
import type { CacheConfig, ICacheManager, Platform } from './types';
import { DEFAULT_CACHE_CONFIG } from './types';

let RealmCacheManagerClass: new () => ICacheManager | undefined;

const getRealmCacheManager = async (): Promise<ICacheManager> => {
  if (!RealmCacheManagerClass) {
    const module = await import('./implementations/realmCache');
    RealmCacheManagerClass = module.RealmCacheManager;
  }
  return new (RealmCacheManagerClass as new () => ICacheManager)();
};

export const createCacheManager = (platform: Platform): ICacheManager | Promise<ICacheManager> => {
  switch (platform) {
    case 'desktop':
      return new TauriCacheManager();
    case 'mobile':
      return getRealmCacheManager();
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
  const managerOrPromise = createCacheManager(platform);

  const manager = managerOrPromise instanceof Promise ? await managerOrPromise : managerOrPromise;

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
