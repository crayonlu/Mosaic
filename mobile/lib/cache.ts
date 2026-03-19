import { getBearerAuthHeaders } from '@/lib/services/apiAuth'
import { getDatabase } from '@/lib/storage/database'
import {
  DEFAULT_CACHE_CONFIG,
  ResourceLoader,
  setPlatformAdapter,
  setResourceLoader,
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
import type { SQLiteDatabase } from 'expo-sqlite'

let resourceLoader: ResourceLoader | null = null
const CACHE_DIR_NAME = 'mosaic-cache'

class SQLiteCacheManager implements ICacheManager {
  private db: SQLiteDatabase | null = null
  private config: CacheConfig = DEFAULT_CACHE_CONFIG.mobile
  private listeners: Map<CacheEventType, Set<CacheEventHandler<any>>> = new Map()
  private cacheDir: Directory | null = null

  private isRenderableLocalPath(path: string): boolean {
    return /^(file|content|asset|data):/i.test(path)
  }

  private ensureReady(): { db: SQLiteDatabase; cacheDir: Directory } {
    if (!this.db || !this.cacheDir) {
      throw new Error('SQLite cache manager not initialized')
    }
    return { db: this.db, cacheDir: this.cacheDir }
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

  private rowToCacheEntry(row: any): CacheEntry {
    return {
      url: row.url,
      localPath: row.local_path,
      size: row.size,
      mimeType: row.mime_type ?? 'application/octet-stream',
      etag: row.etag ?? undefined,
      lastAccessed: row.last_accessed,
      accessCount: row.access_count,
      createdAt: row.created_at,
      expiresAt: row.expires_at ?? undefined,
      isPinned: row.is_pinned === 1,
    }
  }

  private async removeEntry(url: string): Promise<void> {
    if (!this.db) return

    const row = await this.db.getFirstAsync<{ local_path: string }>(
      'SELECT local_path FROM cache_entries WHERE url = ?',
      url
    )

    await this.db.runAsync('DELETE FROM cache_entries WHERE url = ?', url)

    if (row) {
      try {
        const file = new File(row.local_path)
        if (file.exists) file.delete()
      } catch {
        // Ignore missing files during cleanup.
      }
    }
  }

  async initialize(config: CacheConfig): Promise<void> {
    this.config = config
    this.cacheDir = new Directory(Paths.cache, CACHE_DIR_NAME)
    this.cacheDir.create({ idempotent: true, intermediates: true })
    try {
      this.db = await getDatabase()
    } catch (error) {
      console.error('[SQLiteCacheManager] Failed to initialize database:', error)
      throw error
    }
  }

  async get(url: string): Promise<string | null> {
    if (!this.db) {
      return null
    }

    const row = await this.db.getFirstAsync<{
      local_path: string
      expires_at: number | null
    }>('SELECT local_path, expires_at FROM cache_entries WHERE url = ?', url)

    if (!row) return null

    if (row.expires_at && row.expires_at < Date.now()) {
      await this.removeEntry(url)
      return null
    }

    if (!this.isRenderableLocalPath(row.local_path)) {
      await this.removeEntry(url)
      return null
    }

    const file = new File(row.local_path)
    if (!file.exists) {
      await this.removeEntry(url)
      return null
    }

    await this.db.runAsync(
      'UPDATE cache_entries SET last_accessed = ?, access_count = access_count + 1 WHERE url = ?',
      Date.now(),
      url
    )

    return row.local_path
  }

  async set(url: string, data: ArrayBuffer, options?: CacheWriteOptions): Promise<string | null> {
    const { db } = this.ensureReady()

    const file = this.getFile(url, options?.mimeType)
    file.parentDirectory.create({ idempotent: true, intermediates: true })
    if (!file.exists) {
      file.create({ intermediates: true })
    }
    file.write(new Uint8Array(data))

    const now = Date.now()
    await db.runAsync(
      `INSERT INTO cache_entries (url, local_path, mime_type, size, created_at, last_accessed, access_count, etag, expires_at, is_pinned)
       VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?)
       ON CONFLICT(url) DO UPDATE SET
         local_path = excluded.local_path,
         mime_type = excluded.mime_type,
         size = excluded.size,
         last_accessed = excluded.last_accessed,
         access_count = access_count + 1,
         etag = excluded.etag,
         expires_at = excluded.expires_at,
         is_pinned = excluded.is_pinned`,
      url,
      file.uri,
      options?.mimeType || 'application/octet-stream',
      data.byteLength,
      now,
      now,
      options?.etag ?? null,
      options?.maxAge ? now + options.maxAge : null,
      options?.isPinned ? 1 : 0
    )

    await this.prune()
    return file.uri
  }

  async delete(url: string): Promise<void> {
    await this.removeEntry(url)
  }

  async has(url: string): Promise<boolean> {
    if (!this.db) {
      return false
    }

    const row = await this.db.getFirstAsync<{
      local_path: string
      expires_at: number | null
    }>('SELECT local_path, expires_at FROM cache_entries WHERE url = ?', url)

    if (!row) return false

    if (row.expires_at && row.expires_at < Date.now()) {
      await this.removeEntry(url)
      return false
    }

    const file = new File(row.local_path)
    if (!file.exists) {
      await this.removeEntry(url)
      return false
    }

    return true
  }

  async getMetadata(url: string): Promise<CacheEntry | null> {
    if (!this.db) return null

    const row = await this.db.getFirstAsync('SELECT * FROM cache_entries WHERE url = ?', url)

    if (!row) return null

    const entry = this.rowToCacheEntry(row)

    if (entry.expiresAt && entry.expiresAt < Date.now()) {
      await this.removeEntry(url)
      return null
    }

    const file = new File(entry.localPath)
    if (!file.exists) {
      await this.removeEntry(url)
      return null
    }

    return entry
  }

  async list(filter?: CacheFilter): Promise<CacheEntry[]> {
    if (!this.db) return []

    const conditions: string[] = []
    const params: any[] = []

    if (filter) {
      if (filter.mimeType) {
        conditions.push('mime_type = ?')
        params.push(filter.mimeType)
      }
      if (filter.minSize !== undefined) {
        conditions.push('size >= ?')
        params.push(filter.minSize)
      }
      if (filter.maxSize !== undefined) {
        conditions.push('size <= ?')
        params.push(filter.maxSize)
      }
      if (filter.accessedBefore !== undefined) {
        conditions.push('last_accessed < ?')
        params.push(filter.accessedBefore)
      }
      if (filter.accessedAfter !== undefined) {
        conditions.push('last_accessed > ?')
        params.push(filter.accessedAfter)
      }
    }

    const where = conditions.length > 0 ? ` WHERE ${conditions.join(' AND ')}` : ''
    const rows = await this.db.getAllAsync(`SELECT * FROM cache_entries${where}`, ...params)

    return rows.map(row => this.rowToCacheEntry(row))
  }

  async clear(): Promise<void> {
    if (!this.db) return

    const rows = await this.db.getAllAsync<{ local_path: string }>(
      'SELECT local_path FROM cache_entries'
    )

    for (const row of rows) {
      try {
        const file = new File(row.local_path)
        if (file.exists) file.delete()
      } catch {
        // Ignore file cleanup failures during full cache reset.
      }
    }

    await this.db.runAsync('DELETE FROM cache_entries')
  }

  async getUsage(): Promise<CacheUsage> {
    if (!this.db) return { totalSize: 0, itemCount: 0, byType: {} }

    const summary = await this.db.getFirstAsync<{
      total_size: number
      item_count: number
    }>('SELECT COALESCE(SUM(size), 0) as total_size, COUNT(*) as item_count FROM cache_entries')

    const typeRows = await this.db.getAllAsync<{
      type_prefix: string
      count: number
      total: number
    }>(
      `SELECT
         CASE WHEN INSTR(mime_type, '/') > 0 THEN SUBSTR(mime_type, 1, INSTR(mime_type, '/') - 1)
              ELSE 'other' END as type_prefix,
         COUNT(*) as count,
         SUM(size) as total
       FROM cache_entries
       GROUP BY type_prefix`
    )

    const byType: CacheUsage['byType'] = {}
    for (const row of typeRows) {
      byType[row.type_prefix] = { count: row.count, size: row.total }
    }

    return {
      totalSize: summary?.total_size ?? 0,
      itemCount: summary?.item_count ?? 0,
      byType,
    }
  }

  async prune(): Promise<number> {
    if (!this.db) return 0

    const usage = await this.getUsage()
    if (usage.totalSize <= this.config.maxSize) return 0

    const rows = await this.db.getAllAsync<{
      url: string
      size: number
    }>('SELECT url, size FROM cache_entries WHERE is_pinned = 0 ORDER BY last_accessed ASC')

    let pruned = 0
    for (const row of rows) {
      if (usage.totalSize - pruned <= this.config.maxSize * 0.9) break

      try {
        await this.delete(row.url)
        pruned += row.size
      } catch (e) {
        console.warn('Failed to prune cache entry:', row.url, e)
      }
    }

    this.emit('full', { dropped: pruned })
    return pruned
  }

  async touch(url: string): Promise<void> {
    if (!this.db) return

    await this.db.runAsync(
      'UPDATE cache_entries SET last_accessed = ? WHERE url = ?',
      Date.now(),
      url
    )
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
      this.cacheManager = new SQLiteCacheManager()
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

    // Also set the singleton in the cache package so useResourceCache can access it
    setResourceLoader(resourceLoader)
  } else {
  }
  return resourceLoader
}

export const getMobileResourceLoader = (): ResourceLoader | null => {
  return resourceLoader
}

export { SQLiteCacheManager }
