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
import { Directory, File, Paths } from 'expo-file-system'
import { Realm } from '@realm/react'

let resourceLoader: ResourceLoader | null = null
const CACHE_DIR_NAME = 'mosaic-cache'

class CacheEntryObject extends Realm.Object<CacheEntryObject> {
  url!: string
  localPath!: string
  size!: number
  mimeType?: string
  etag?: string
  lastAccessed!: number
  accessCount!: number
  createdAt!: number
  expiresAt?: number
  metadata?: string
  isPinned!: boolean

  static schema: Realm.ObjectSchema = {
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

  toCacheEntry(): CacheEntry {
    return {
      url: this.url,
      localPath: this.localPath,
      size: this.size,
      mimeType: this.mimeType ?? 'application/octet-stream',
      etag: this.etag,
      lastAccessed: this.lastAccessed,
      accessCount: this.accessCount,
      createdAt: this.createdAt,
      expiresAt: this.expiresAt,
      isPinned: this.isPinned,
    }
  }
}

class RealmCacheManager implements ICacheManager {
  private realm: Realm | null = null
  private config: CacheConfig = DEFAULT_CACHE_CONFIG.mobile
  private listeners: Map<CacheEventType, Set<CacheEventHandler<any>>> = new Map()
  private cacheDir: Directory | null = null

  private isRenderableLocalPath(path: string): boolean {
    return /^(file|content|asset|data):/i.test(path)
  }

  private ensureReady(): { realm: Realm; cacheDir: Directory } {
    if (!this.realm || !this.cacheDir) {
      throw new Error('Realm cache manager not initialized')
    }

    return {
      realm: this.realm,
      cacheDir: this.cacheDir,
    }
  }

  private hashUrl(url: string): string {
    let hash = 5381
    for (let i = 0; i < url.length; i++) {
      hash = (hash * 33) ^ url.charCodeAt(i)
    }
    return (hash >>> 0).toString(36)
  }

  private getExtension(url: string, mimeType?: string): string {
    const urlExtMatch = url.match(/\.([a-zA-Z0-9]+)(?:\?|#|$)/)
    if (urlExtMatch?.[1]) {
      return urlExtMatch[1].toLowerCase()
    }

    if (mimeType) {
      const mimeExt = mimeType.split('/')[1]?.split(';')[0]?.trim().toLowerCase()
      if (mimeExt) {
        return mimeExt === 'jpeg' ? 'jpg' : mimeExt
      }
    }

    return 'bin'
  }

  private getFile(url: string, mimeType?: string): File {
    const { cacheDir } = this.ensureReady()
    return new File(cacheDir, `${this.hashUrl(url)}.${this.getExtension(url, mimeType)}`)
  }

  private async removeEntry(url: string): Promise<void> {
    if (!this.realm) return

    const entry = this.realm.objectForPrimaryKey(CacheEntryObject, url)
    if (!entry) return

    const file = new File(entry.localPath)

    this.realm.write(() => {
      const staleEntry = this.realm!.objectForPrimaryKey(CacheEntryObject, url)
      if (staleEntry) {
        this.realm!.delete(staleEntry)
      }
    })

    try {
      if (file.exists) {
        file.delete()
      }
    } catch {
      // Ignore missing or already-deleted files while cleaning stale entries.
    }
  }

  async initialize(config: CacheConfig): Promise<void> {
    this.config = config
    this.cacheDir = new Directory(Paths.cache, CACHE_DIR_NAME)
    this.cacheDir.create({ idempotent: true, intermediates: true })

    this.realm = await Realm.open({
      schema: [CacheEntryObject],
      schemaVersion: 1,
    })
  }

  async get(url: string): Promise<string | null> {
    if (!this.realm) return null

    const entry = this.realm.objectForPrimaryKey(CacheEntryObject, url)
    if (!entry) return null

    if (entry.expiresAt && entry.expiresAt < Date.now()) {
      await this.removeEntry(url)
      return null
    }

    if (!this.isRenderableLocalPath(entry.localPath)) {
      await this.removeEntry(url)
      return null
    }

    const file = new File(entry.localPath)
    if (!file.exists) {
      await this.removeEntry(url)
      return null
    }

    this.realm.write(() => {
      entry.lastAccessed = Date.now()
      entry.accessCount += 1
    })

    return entry.localPath
  }

  async set(url: string, data: ArrayBuffer, options?: CacheWriteOptions): Promise<string | null> {
    const { realm } = this.ensureReady()

    const file = this.getFile(url, options?.mimeType)
    file.parentDirectory.create({ idempotent: true, intermediates: true })
    if (!file.exists) {
      file.create({ intermediates: true })
    }
    file.write(new Uint8Array(data))

    const now = Date.now()
    realm.write(() => {
      realm.create(
        CacheEntryObject,
        {
          url,
          localPath: file.uri,
          mimeType: options?.mimeType || 'application/octet-stream',
          size: data.byteLength,
          createdAt: now,
          lastAccessed: now,
          accessCount: 1,
          etag: options?.etag,
          expiresAt: options?.maxAge ? now + options.maxAge : undefined,
          isPinned: options?.isPinned || false,
        },
        Realm.UpdateMode.Modified,
      )
    })

    await this.prune()
    return file.uri
  }

  async delete(url: string): Promise<void> {
    await this.removeEntry(url)
  }

  async has(url: string): Promise<boolean> {
    if (!this.realm) return false

    const entry = this.realm.objectForPrimaryKey(CacheEntryObject, url)
    if (!entry) return false

    if (entry.expiresAt && entry.expiresAt < Date.now()) {
      await this.removeEntry(url)
      return false
    }

    const file = new File(entry.localPath)
    if (!file.exists) {
      await this.removeEntry(url)
      return false
    }

    return true
  }

  async getMetadata(url: string): Promise<CacheEntry | null> {
    if (!this.realm) return null

    const entry = this.realm.objectForPrimaryKey(CacheEntryObject, url)
    if (!entry) return null

    if (entry.expiresAt && entry.expiresAt < Date.now()) {
      await this.removeEntry(url)
      return null
    }

    const file = new File(entry.localPath)
    if (!file.exists) {
      await this.removeEntry(url)
      return null
    }

    return entry.toCacheEntry()
  }

  async list(filter?: CacheFilter): Promise<CacheEntry[]> {
    if (!this.realm) return []

    let entries = this.realm.objects(CacheEntryObject)

    if (filter) {
      if (filter.mimeType) {
        entries = entries.filtered('mimeType == $0', filter.mimeType)
      }
      if (filter.minSize !== undefined) {
        entries = entries.filtered('size >= $0', filter.minSize)
      }
      if (filter.maxSize !== undefined) {
        entries = entries.filtered('size <= $0', filter.maxSize)
      }
      if (filter.accessedBefore !== undefined) {
        entries = entries.filtered('lastAccessed < $0', filter.accessedBefore)
      }
      if (filter.accessedAfter !== undefined) {
        entries = entries.filtered('lastAccessed > $0', filter.accessedAfter)
      }
    }

    return entries.map(entry => entry.toCacheEntry())
  }

  async clear(): Promise<void> {
    if (!this.realm) return

    const entries = this.realm.objects(CacheEntryObject)
    for (const entry of entries) {
      try {
        const file = new File(entry.localPath)
        if (file.exists) {
          file.delete()
        }
      } catch {
        // Ignore file cleanup failures during full cache reset.
      }
    }

    this.realm.write(() => this.realm!.deleteAll())
  }

  async getUsage(): Promise<CacheUsage> {
    if (!this.realm) {
      return { totalSize: 0, itemCount: 0, byType: {} }
    }

    const entries = this.realm.objects(CacheEntryObject)
    const totalSize = entries.reduce((sum, entry) => sum + entry.size, 0)
    const byType: CacheUsage['byType'] = {}

    for (const entry of entries) {
      const type = entry.mimeType?.split('/')[0] ?? 'other'
      if (!byType[type]) {
        byType[type] = { count: 0, size: 0 }
      }
      byType[type]!.count += 1
      byType[type]!.size += entry.size
    }

    return {
      totalSize,
      itemCount: entries.length,
      byType,
    }
  }

  async prune(): Promise<number> {
    if (!this.realm) return 0

    const usage = await this.getUsage()
    if (usage.totalSize <= this.config.maxSize) return 0

    const entries = this.realm
      .objects(CacheEntryObject)
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
      const entry = this.realm!.objectForPrimaryKey(CacheEntryObject, url)
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

  private emit(type: CacheEventType, event: any): void {
    this.listeners.get(type)?.forEach(handler => handler(event))
  }
}

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
        return await fetch(url, {
          ...options,
          headers: { ...headers, ...options?.headers },
        })
      },
      async post(url: string, data?: BodyInit, options?: RequestInit): Promise<Response> {
        const headers = self.authHeaderProvider ? await self.authHeaderProvider() : {}
        return await fetch(url, {
          method: 'POST',
          body: data,
          ...options,
          headers: { ...headers, ...options?.headers },
        })
      },
    }
  }

  getPlatform(): 'desktop' | 'mobile' | 'web' {
    return 'mobile'
  }

  async getCacheDir(): Promise<string> {
    const targetDir = new Directory(Paths.cache, CACHE_DIR_NAME)
    targetDir.create({ idempotent: true, intermediates: true })
    return targetDir.uri
  }

  async fileExists(path: string): Promise<boolean> {
    return new File(path).exists
  }

  async readFile(path: string): Promise<Uint8Array> {
    return await new File(path).bytes()
  }

  async writeFile(path: string, data: Uint8Array): Promise<void> {
    const file = new File(path)
    file.parentDirectory.create({ idempotent: true, intermediates: true })
    if (!file.exists) {
      file.create({ intermediates: true })
    }
    file.write(data)
  }

  async deleteFile(path: string): Promise<void> {
    const file = new File(path)
    if (file.exists) {
      file.delete()
    }
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

export { RealmCacheManager }
