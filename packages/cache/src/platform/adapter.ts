import type { CacheConfig, ICacheManager } from '../types.js';
import { DEFAULT_CACHE_CONFIG } from '../types.js';

export type PlatformType = 'desktop' | 'mobile' | 'web';

export interface HttpClient {
  get(url: string, options?: RequestInit): Promise<Response>;
  post(url: string, data?: BodyInit, options?: RequestInit): Promise<Response>;
}

export interface PlatformAdapter {
  getCacheManager(): Promise<ICacheManager>;
  getHttpClient(): HttpClient;
  getPlatform(): PlatformType;
  getCacheDir(): Promise<string>;
  fileExists(path: string): Promise<boolean>;
  readFile(path: string): Promise<Uint8Array>;
  writeFile(path: string, data: Uint8Array): Promise<void>;
  deleteFile(path: string): Promise<void>;
}

let platformAdapter: PlatformAdapter | null = null;
let cacheManager: ICacheManager | null = null;

export const detectPlatform = (): PlatformType => {
  if (typeof window === 'undefined') return 'web';
  if ('__TAURI__' in window) return 'desktop';
  const userAgent = navigator.userAgent.toLowerCase();
  if (/android|iphone|ipad|ipod|mobile/i.test(userAgent)) return 'mobile';
  return 'web';
};

export const setPlatformAdapter = (adapter: PlatformAdapter): void => {
  platformAdapter = adapter;
  cacheManager = null;
};

export const getPlatformAdapter = (): PlatformAdapter => {
  if (!platformAdapter) {
    throw new Error('Platform adapter not initialized. Call setPlatformAdapter() first.');
  }
  return platformAdapter;
};

export const getCacheManager = async (): Promise<ICacheManager> => {
  if (!cacheManager) {
    const adapter = getPlatformAdapter();
    cacheManager = await adapter.getCacheManager();
  }
  return cacheManager;
};

export const resetCacheManager = (): void => {
  cacheManager = null;
};

export const getDefaultConfig = (platform?: PlatformType): CacheConfig => {
  const targetPlatform = platform ?? detectPlatform();
  return DEFAULT_CACHE_CONFIG[targetPlatform];
};
