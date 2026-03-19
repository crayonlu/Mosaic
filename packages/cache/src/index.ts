// Core types and interfaces (shared across all platforms)
export * from './abstract';
export * from './types';

// Platform adapter interface
export * from './platform/adapter';

// Utility functions
export * from './utils/hash';
export * from './utils/policy';

// ResourceLoader service (core caching logic)
export { getResourceLoader, setResourceLoader, ResourceLoader } from './services/resourceLoader';

// React hooks for resource caching
export * from './hooks/useResourceCache';

// Re-export ICacheManager for type compatibility
export type { ICacheManager } from './types';

// Web-only: MemoryCacheManager for browser
export { MemoryCacheManager } from './implementations/memoryCache';

// Platform-specific cache managers must be provided by the app:
// - Desktop: TauriCacheManager from desktop/src/lib/cache.ts
// - Mobile: SQLiteCacheManager from mobile/lib/cache.ts
