export type Platform = 'desktop' | 'mobile' | 'web';

export type StorageStrategy = 'lru' | 'lfu' | 'fifo';

export interface CacheConfig {
  maxSize: number;
  defaultMaxAge: number;
  storageStrategy: StorageStrategy;
  enableOffline: boolean;
  networkSensitive: boolean;
  prefetch?: PrefetchConfig;
}

export interface PrefetchConfig {
  enabled: boolean;
  maxConcurrent: number;
  delayMs: number;
}

export interface CacheEntry {
  url: string;
  localPath: string;
  mimeType: string;
  size: number;
  createdAt: number;
  lastAccessed: number;
  accessCount: number;
  etag?: string;
  expiresAt?: number;
  isPinned: boolean;
}

export interface CacheWriteOptions {
  mimeType?: string;
  etag?: string;
  maxAge?: number;
  isPinned?: boolean;
}

export interface CacheUsage {
  totalSize: number;
  itemCount: number;
  byType: Record<string, { count: number; size: number }>;
}

export interface CacheFilter {
  mimeType?: string;
  minSize?: number;
  maxSize?: number;
  accessedBefore?: number;
  accessedAfter?: number;
}

export type LoadSource = 'cache' | 'network' | 'offline';

export interface LoadedResource {
  source: LoadSource;
  data?: ArrayBuffer;
  path?: string;
}

export interface LoadOptions {
  forceRefresh?: boolean;
  allowOffline?: boolean;
}

export interface CacheEventMap {
  hit: { url: string; entry: CacheEntry };
  miss: { url: string };
  evict: { url: string; reason: EvictReason };
  error: { url: string; error: Error };
  full: { dropped: number };
}

export type EvictReason = 'expired' | 'size-limit' | 'manual' | 'policy';

export type CacheEventType = keyof CacheEventMap;

export type CacheEventHandler<T extends CacheEventType> = (event: CacheEventMap[T]) => void;

export interface ICacheManager {
  initialize(config: CacheConfig): Promise<void>;
  get(url: string): Promise<string | null>;
  set(url: string, data: ArrayBuffer, options?: CacheWriteOptions): Promise<void>;
  delete(url: string): Promise<void>;
  has(url: string): Promise<boolean>;
  getMetadata(url: string): Promise<CacheEntry | null>;
  list(filter?: CacheFilter): Promise<CacheEntry[]>;
  clear(): Promise<void>;
  getUsage(): Promise<CacheUsage>;
  prune(): Promise<number>;
  on<T extends CacheEventType>(type: T, handler: CacheEventHandler<T>): () => void;
}

export type PlatformCacheManager<T extends Platform> = T extends 'desktop'
  ? ICacheManager
  : T extends 'mobile'
    ? ICacheManager
    : ICacheManager;

export const DEFAULT_CACHE_CONFIG: Record<Platform, CacheConfig> = {
  desktop: {
    maxSize: 2 * 1024 * 1024 * 1024,
    defaultMaxAge: 7 * 24 * 60 * 60 * 1000,
    storageStrategy: 'lru',
    enableOffline: true,
    networkSensitive: false,
    prefetch: {
      enabled: true,
      maxConcurrent: 3,
      delayMs: 1000,
    },
  },
  mobile: {
    maxSize: 512 * 1024 * 1024,
    defaultMaxAge: 3 * 24 * 60 * 60 * 1000,
    storageStrategy: 'lfu',
    enableOffline: true,
    networkSensitive: true,
    prefetch: {
      enabled: false,
      maxConcurrent: 1,
      delayMs: 3000,
    },
  },
  web: {
    maxSize: 100 * 1024 * 1024,
    defaultMaxAge: 1 * 24 * 60 * 60 * 1000,
    storageStrategy: 'fifo',
    enableOffline: false,
    networkSensitive: true,
  },
};

export const isCacheEntry = (value: unknown): value is CacheEntry =>
  typeof value === 'object' &&
  value !== null &&
  'url' in value &&
  'localPath' in value &&
  typeof (value as CacheEntry).size === 'number';

export const isExpired = (entry: CacheEntry, now: number = Date.now()): boolean =>
  entry.expiresAt !== undefined && entry.expiresAt < now;

export const createCacheKey = (url: string, prefix?: string): string => {
  const hash = url.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 64);
  return prefix ? `${prefix}_${hash}` : hash;
};
