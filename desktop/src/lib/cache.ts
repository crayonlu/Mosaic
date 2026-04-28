import { apiClient } from '@mosaic/api'
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
import { convertFileSrc } from '@tauri-apps/api/core'
import { appCacheDir, join } from '@tauri-apps/api/path'
import {
  exists,
  mkdir,
  readTextFile,
  remove,
  writeFile,
  writeTextFile,
} from '@tauri-apps/plugin-fs'

let resourceLoader: ResourceLoader | null = null

class TauriPlatformAdapter implements PlatformAdapter {
  private authHeaderProvider: (() => Promise<Record<string, string>>) | null = null

  async getCacheManager(): Promise<ICacheManager> {
    const cacheManager = new TauriCacheManager()
    await cacheManager.initialize(DEFAULT_CACHE_CONFIG.desktop)
    return cacheManager
  }

  getHttpClient(): {
    get(url: string, options?: RequestInit): Promise<Response>
    post(url: string, data?: BodyInit, options?: RequestInit): Promise<Response>
  } {
    return {
      get: async (url: string, options?: RequestInit): Promise<Response> => {
        const headers = this.authHeaderProvider ? await this.authHeaderProvider() : {}
        const response = await fetch(url, {
          ...options,
          headers: { ...headers, ...options?.headers },
        })
        return response
      },
      post: async (url: string, data?: BodyInit, options?: RequestInit): Promise<Response> => {
        const headers = this.authHeaderProvider ? await this.authHeaderProvider() : {}
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
    return 'desktop'
  }

  async getCacheDir(): Promise<string> {
    const baseDir = await appCacheDir()
    return await join(baseDir, 'mosaic-cache')
  }

  async fileExists(path: string): Promise<boolean> {
    return await exists(path)
  }

  async readFile(path: string): Promise<Uint8Array> {
    return await import('@tauri-apps/plugin-fs').then(m => m.readFile(path))
  }

  async writeFile(path: string, data: Uint8Array): Promise<void> {
    await import('@tauri-apps/plugin-fs').then(m => m.writeFile(path, data))
  }

  async deleteFile(path: string): Promise<void> {
    await remove(path)
  }

  setAuthHeaderProvider(provider: () => Promise<Record<string, string>>): void {
    this.authHeaderProvider = provider
  }
}

class TauriCacheManager implements ICacheManager {
  private cacheDir = ''
  private indexPath = ''
  private index: Map<string, CacheEntry> = new Map()
  private config: CacheConfig = DEFAULT_CACHE_CONFIG.desktop
  private listeners: Map<CacheEventType, Set<(...args: any[]) => void>> = new Map()

  async initialize(config: CacheConfig): Promise<void> {
    this.config = config

    const baseDir = await appCacheDir()
    this.cacheDir = await join(baseDir, 'mosaic-cache')
    this.indexPath = await join(this.cacheDir, 'index.json')

    // Ensure cache directory exists
    const dirExists = await exists(this.cacheDir)
    if (!dirExists) {
      await mkdir(this.cacheDir, { recursive: true })
    }

    const indexExists = await exists(this.indexPath)
    if (indexExists) {
      try {
        const content = await readTextFile(this.indexPath)
        const data = JSON.parse(content)
        this.index = new Map(Object.entries(data))
      } catch (e) {
        console.warn('Failed to load cache index:', e)
      }
    }
  }

  private async saveIndex(): Promise<void> {
    const data: Record<string, CacheEntry> = {}
    this.index.forEach((value, key) => {
      data[key] = value
    })
    await writeTextFile(this.indexPath, JSON.stringify(data, null, 2))
  }

  private getFilePath(url: string, mimeType?: string): string {
    // Use a stable hash for the full URL to avoid filename collisions.
    const hash = this.hashUrl(url)
    const ext = this.getExtension(url, mimeType)
    return `${this.cacheDir}/${hash}.${ext}`
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

  private hasFileExtension(path: string): boolean {
    const lastSegment = path.split(/[\\/]/).pop() || ''
    return /\.[a-zA-Z0-9]+$/.test(lastSegment)
  }

  async get(url: string): Promise<string | null> {
    const entry = this.index.get(url)
    if (!entry) return null

    const filePath = entry.localPath || this.getFilePath(url, entry.mimeType)

    // Legacy cache files used extensionless names and may collide across URLs.
    if (!this.hasFileExtension(filePath)) {
      this.index.delete(url)
      await this.saveIndex()
      return null
    }

    const fileExists = await exists(filePath)
    if (!fileExists) {
      this.index.delete(url)
      await this.saveIndex()
      return null
    }

    entry.lastAccessed = Date.now()
    entry.accessCount++
    await this.saveIndex()
    this.emit('hit', { url, entry })

    // Convert file path to Tauri asset protocol URL for WebView
    return convertFileSrc(filePath)
  }

  async set(url: string, data: ArrayBuffer, options?: CacheWriteOptions): Promise<string | null> {
    const filePath = this.getFilePath(url, options?.mimeType)
    const buffer = new Uint8Array(data)

    await writeFile(filePath, buffer)

    const entry: CacheEntry = {
      url,
      localPath: filePath,
      mimeType: options?.mimeType || 'application/octet-stream',
      size: data.byteLength,
      createdAt: Date.now(),
      lastAccessed: Date.now(),
      accessCount: 1,
      etag: options?.etag,
      expiresAt: options?.maxAge ? Date.now() + options.maxAge : undefined,
      isPinned: options?.isPinned || false,
    }

    this.index.set(url, entry)
    await this.saveIndex()

    await this.prune()

    return convertFileSrc(filePath)
  }

  async delete(url: string): Promise<void> {
    const entry = this.index.get(url)
    if (entry) {
      const filePath = entry.localPath || this.getFilePath(url, entry.mimeType)
      const fileExists = await exists(filePath)
      if (fileExists) {
        await remove(filePath)
      }
      this.index.delete(url)
      await this.saveIndex()
    }
  }

  async has(url: string): Promise<boolean> {
    return this.index.has(url)
  }

  async getMetadata(url: string): Promise<CacheEntry | null> {
    return this.index.get(url) || null
  }

  async list(filter?: CacheFilter): Promise<CacheEntry[]> {
    let entries = Array.from(this.index.values())

    if (filter?.mimeType) {
      entries = entries.filter(e => e.mimeType === filter.mimeType)
    }
    if (filter?.minSize) {
      entries = entries.filter(e => e.size >= filter.minSize!)
    }
    if (filter?.maxSize) {
      entries = entries.filter(e => e.size <= filter.maxSize!)
    }
    if (filter?.accessedBefore) {
      entries = entries.filter(e => e.lastAccessed < filter.accessedBefore!)
    }
    if (filter?.accessedAfter) {
      entries = entries.filter(e => e.lastAccessed > filter.accessedAfter!)
    }

    return entries
  }

  async clear(): Promise<void> {
    for (const entry of this.index.values()) {
      try {
        const fileExists = await exists(entry.localPath)
        if (fileExists) {
          await remove(entry.localPath)
        }
      } catch (e) {
        console.warn('Failed to delete cache file:', entry.localPath, e)
      }
    }
    this.index.clear()
    await this.saveIndex()
  }

  async getUsage(): Promise<CacheUsage> {
    const entries = Array.from(this.index.values())
    const totalSize = entries.reduce((sum, e) => sum + e.size, 0)

    const byType: Record<string, { count: number; size: number }> = {}
    for (const entry of entries) {
      const type = entry.mimeType.split('/')[0] || 'other'
      if (!byType[type]) {
        byType[type] = { count: 0, size: 0 }
      }
      byType[type].count++
      byType[type].size += entry.size
    }

    return {
      totalSize,
      itemCount: entries.length,
      byType,
    }
  }

  async prune(): Promise<number> {
    const usage = await this.getUsage()
    if (usage.totalSize <= this.config.maxSize) return 0

    const entries = Array.from(this.index.values())
      .filter(e => !e.isPinned)
      .sort((a, b) => a.lastAccessed - b.lastAccessed)

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
    const entry = this.index.get(url)
    if (entry) {
      entry.lastAccessed = Date.now()
      await this.saveIndex()
    }
  }

  on<T extends CacheEventType>(type: T, handler: CacheEventHandler<T>): () => void {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set())
    }
    this.listeners.get(type)!.add(handler as (...args: any[]) => void)
    return () => {
      this.listeners.get(type)?.delete(handler as (...args: any[]) => void)
    }
  }

  private emit(type: CacheEventType, event: unknown): void {
    this.listeners.get(type)?.forEach(handler => handler(event))
  }
}

export const initializeDesktopCache = async (): Promise<ResourceLoader> => {
  if (!resourceLoader) {
    const adapter = new TauriPlatformAdapter()

    adapter.setAuthHeaderProvider(async (): Promise<Record<string, string>> => {
      const token = await apiClient.getTokenStorage()?.getAccessToken()
      if (!token) return {}
      return { Authorization: `Bearer ${token}` }
    })

    setPlatformAdapter(adapter)

    const cacheManager = new TauriCacheManager()
    await cacheManager.initialize(DEFAULT_CACHE_CONFIG.desktop)

    resourceLoader = new ResourceLoader(cacheManager, adapter)
    await resourceLoader.initialize()
  }
  return resourceLoader
}

export const getDesktopResourceLoader = (): ResourceLoader | null => {
  return resourceLoader
}

export const loadResource = async (
  url: string,
  options?: {
    forceRefresh?: boolean
    allowOffline?: boolean
  }
) => {
  if (!resourceLoader) {
    await initializeDesktopCache()
  }
  return resourceLoader!.load(url, options)
}

export const prefetchResources = async (
  urls: string[],
  options?: {
    concurrency?: number
    delayMs?: number
  }
) => {
  if (!resourceLoader) {
    await initializeDesktopCache()
  }
  return resourceLoader!.prefetch(urls, options)
}

export const clearResourceCache = async (): Promise<void> => {
  if (!resourceLoader) {
    await initializeDesktopCache()
  }
  return resourceLoader!.clearCache()
}
