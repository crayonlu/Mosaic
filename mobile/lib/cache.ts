import { getBearerAuthHeaders } from '@/lib/services/apiAuth'
import {
  DEFAULT_CACHE_CONFIG,
  ResourceLoader,
  setPlatformAdapter,
  type CacheConfig,
  type CacheEntry,
  type CacheEventHandler,
  type CacheEventType,
  type CacheFilter,
  type CacheUsage,
  type CacheWriteOptions,
  type ICacheManager,
  type PlatformAdapter,
} from '@mosaic/cache'
import Realm from 'realm'

let resourceLoader: ResourceLoader | null = null

// Realm schema for cache entries
const CacheEntrySchema: Realm.ObjectSchema = {
  name: 'CacheEntry',
  primaryKey: 'url',
  properties: {
    url: 'string',
    localPath: 'string',
    size: 'int',
    mimeType: 'string?',
    etag: 'string?',
    lastAccessed: 'int',
    accessCount: 'int',
    createdAt: 'int',
    expiresAt: 'int?',
    metadata: 'string?',
    isPinned: { type: 'bool', default: false },
  },
}

// RealmCacheManager - Mobile-specific cache using Realm
class RealmCacheManager implements ICacheManager {
  private realm: Realm | null = null
  private config: CacheConfig = DEFAULT_CACHE_CONFIG.mobile
  private listeners: Map<CacheEventType, Set<CacheEventHandler<any>>> = new Map()

  async initialize(config: CacheConfig): Promise<void> {
    this.config = config

    this.realm = await Realm.open({
      schema: [CacheEntrySchema],
      schemaVersion: 1,
    })
  }

  async get(url: string): Promise<string | null> {
    if (!this.realm) return null

    const entry = this.realm.objectForPrimaryKey<CacheEntry & { localPath: string }>(
      'CacheEntry',
      url
    )
    if (!entry) return null

    // Update access time
    this.realm.write(() => {
      entry.lastAccessed = Date.now()
      entry.accessCount += 1
    })

    return entry.localPath
  }

  async set(url: string, data: ArrayBuffer, options?: CacheWriteOptions): Promise<string | null> {
    if (!this.realm) return null

    const localPath = this.getLocalPath(url)
    const size = data.byteLength

    // Write to file system would be done here
    // For now, we store metadata in Realm

    this.realm.write(() => {
      this.realm!.create<CacheEntry & { localPath: string }>(
        'CacheEntry',
        {
          url,
          localPath,
          size,
          mimeType: options?.mimeType,
          etag: options?.etag,
          lastAccessed: Date.now(),
          accessCount: 1,
          createdAt: Date.now(),
          expiresAt: options?.expiresAt,
          metadata: options?.metadata ? JSON.stringify(options.metadata) : undefined,
          isPinned: false,
        },
        Realm.UpdateMode.Modified
      )
    })

    await this.prune()
    return localPath
  }

  async delete(url: string): Promise<void> {
    if (!this.realm) return

    this.realm.write(() => {
      const entry = this.realm!.objectForPrimaryKey('CacheEntry', url)
      if (entry) {
        this.realm!.delete(entry)
      }
    })
  }

  async has(url: string): Promise<boolean> {
    if (!this.realm) return false
    return this.realm.objectForPrimaryKey('CacheEntry', url) !== null
  }

  async getMetadata(url: string): Promise<CacheEntry | null> {
    if (!this.realm) return null

    const entry = this.realm.objectForPrimaryKey<
      CacheEntry & { localPath: string; metadata: string }
    >('CacheEntry', url)
    if (!entry) return null

    return {
      url: entry.url,
      size: entry.size,
      mimeType: entry.mimeType ?? undefined,
      etag: entry.etag ?? undefined,
      lastAccessed: entry.lastAccessed,
      accessCount: entry.accessCount,
      createdAt: entry.createdAt,
      expiresAt: entry.expiresAt ?? undefined,
      isPinned: entry.isPinned,
      metadata: entry.metadata ? JSON.parse(entry.metadata) : undefined,
    }
  }

  async list(filter?: CacheFilter): Promise<CacheEntry[]> {
    if (!this.realm) return []

    let entries = this.realm.objects<CacheEntry & { localPath: string; metadata: string }>(
      'CacheEntry'
    )

    if (filter) {
      if (filter.mimeType) {
        entries = entries.filtered('mimeType == $0', filter.mimeType)
      }
      if (filter.minSize) {
        entries = entries.filtered('size >= $0', filter.minSize)
      }
      if (filter.maxSize) {
        entries = entries.filtered('size <= $0', filter.maxSize)
      }
      if (filter.isPinned !== undefined) {
        entries = entries.filtered('isPinned == $0', filter.isPinned)
      }
    }

    return entries.map(entry => ({
      url: entry.url,
      size: entry.size,
      mimeType: entry.mimeType ?? undefined,
      etag: entry.etag ?? undefined,
      lastAccessed: entry.lastAccessed,
      accessCount: entry.accessCount,
      createdAt: entry.createdAt,
      expiresAt: entry.expiresAt ?? undefined,
      isPinned: entry.isPinned,
      metadata: entry.metadata ? JSON.parse(entry.metadata) : undefined,
    }))
  }

  async clear(): Promise<void> {
    if (!this.realm) return

    this.realm.write(() => {
      this.realm!.deleteAll()
    })
  }

  async getUsage(): Promise<CacheUsage> {
    if (!this.realm) {
      return { totalSize: 0, itemCount: 0, byType: {} }
    }

    const entries = this.realm.objects<CacheEntry>('CacheEntry')
    const totalSize = entries.reduce((sum: number, entry: any) => sum + entry.size, 0)

    return {
      totalSize,
      itemCount: entries.length,
      byType: {},
    }
  }

  async prune(): Promise<number> {
    if (!this.realm) return 0

    const usage = await this.getUsage()
    if (usage.totalSize <= this.config.maxSize) return 0

    const entries = this.realm
      .objects<CacheEntry>('CacheEntry')
      .filtered('isPinned == false')
      .sorted('lastAccessed')

    let pruned = 0
    for (const entry of entries) {
      if (usage.totalSize - pruned <= this.config.maxSize * 0.9) break

      try {
        await this.delete(entry.url)
        pruned += entry.size
      } catch (e) {
        console.warn('Failed to prune cache entry:', entry.url, e)
      }
    }

    this.emit('full', { dropped: pruned })
    return pruned
  }

  async touch(url: string): Promise<void> {
    if (!this.realm) return

    this.realm.write(() => {
      const entry = this.realm!.objectForPrimaryKey('CacheEntry', url)
      if (entry) {
        entry.lastAccessed = Date.now()
      }
    })
  }

  on<T extends CacheEventType>(type: T, handler: CacheEventHandler<T>): () => void {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set())
    }
    this.listeners.get(type)!.add(handler)
    return () => {
      this.listeners.get(type)?.delete(handler)
    }
  }

  private getLocalPath(url: string): string {
    const hash = url.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 64)
    return `cache/${hash}`
  }

  private emit(type: CacheEventType, event: any): void {
    this.listeners.get(type)?.forEach(handler => handler(event))
  }
}

// Local MobilePlatformAdapter
class MobilePlatformAdapter implements PlatformAdapter {
  private authHeaderProvider: (() => Promise<Record<string, string>>) | null = null
  private cacheManager: ICacheManager | null = null

  async getCacheManager(): Promise<ICacheManager> {
    if (!this.cacheManager) {
      this.cacheManager = new RealmCacheManager()
      await this.cacheManager.initialize(DEFAULT_CACHE_CONFIG.mobile)
    }
    return this.cacheManager
  }

  getHttpClient(): {
    get(url: string, options?: RequestInit): Promise<Response>
    post(url: string, data?: BodyInit, options?: RequestInit): Promise<Response>
  } {
    const self = this
    return {
      async get(url: string, options?: RequestInit): Promise<Response> {
        const headers = self.authHeaderProvider ? await self.authHeaderProvider() : {}
        const response = await fetch(url, {
          ...options,
          headers: { ...headers, ...options?.headers },
        })
        return response
      },
      async post(url: string, data?: BodyInit, options?: RequestInit): Promise<Response> {
        const headers = self.authHeaderProvider ? await self.authHeaderProvider() : {}
        const response = await fetch(url, {
          method: 'POST',
          body: data,
          ...options,
          headers: { ...headers, ...options?.headers },
        })
        return response
      },
    }
  }

  getPlatform(): 'desktop' | 'mobile' | 'web' {
    return 'mobile'
  }

  async getCacheDir(): Promise<string> {
    return 'cache'
  }

  async fileExists(_path: string): Promise<boolean> {
    // File system check would go here
    return false
  }

  async readFile(_path: string): Promise<Uint8Array> {
    return new Uint8Array(0)
  }

  async writeFile(_path: string, _data: Uint8Array): Promise<void> {
    // File write would go here
  }

  async deleteFile(_path: string): Promise<void> {
    // File delete would go here
  }

  setAuthHeaderProvider(provider: () => Promise<Record<string, string>>): void {
    this.authHeaderProvider = provider
  }
}

export const initializeMobileCache = async (): Promise<ResourceLoader> => {
  if (!resourceLoader) {
    const adapter = new MobilePlatformAdapter()
    adapter.setAuthHeaderProvider(getBearerAuthHeaders)

    setPlatformAdapter(adapter)

    const cacheManager = await adapter.getCacheManager()
    resourceLoader = new ResourceLoader(cacheManager, adapter)
    await resourceLoader.initialize()
  }
  return resourceLoader
}

export const getMobileResourceLoader = (): ResourceLoader | null => {
  return resourceLoader
}

// Re-export for type compatibility
export { RealmCacheManager }
