export * from './abstract.js';
export * from './implementations/memory-cache.js';
export * from './implementations/realm-cache.js';
export * from './implementations/tauri-cache.js';
export * from './types.js';
export * from './utils/hash.js';
export * from './utils/policy.js';

import { MemoryCacheManager } from './implementations/memory-cache.js';
import { RealmCacheManager } from './implementations/realm-cache.js';
import { TauriCacheManager } from './implementations/tauri-cache.js';
import type { CacheConfig, ICacheManager, Platform } from './types.js';
import { DEFAULT_CACHE_CONFIG } from './types.js';

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

export const detectPlatform = (): Platform => {
  if (typeof window === 'undefined') return 'web';
  if ('__TAURI__' in window) return 'desktop';
  const userAgent = navigator.userAgent.toLowerCase();
  if (/android|iphone|ipad|ipod|mobile/i.test(userAgent)) return 'mobile';
  return 'web';
};

export const createAutoCacheManager = async (
  config?: Partial<CacheConfig>
): Promise<ICacheManager> => {
  const platform = detectPlatform();
  return createCacheManagerWithConfig(platform, config);
};
