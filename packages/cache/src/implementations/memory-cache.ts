import { AbstractCacheManager } from '../abstract.js';
import type {
  CacheConfig,
  CacheEntry,
  CacheFilter,
  CacheUsage,
  CacheWriteOptions,
  EvictReason,
} from '../types.js';

export class MemoryCacheManager extends AbstractCacheManager {
  private cache: Map<string, CacheEntry> = new Map();

  async initialize(config: CacheConfig): Promise<void> {
    this.config = config;
    this.initialized = true;
    await this.enforceLimit();
  }

  async get(url: string): Promise<string | null> {
    this.ensureInitialized();
    const entry = await this.getMetadata(url);

    if (!entry) {
      this.emit('miss', { url });
      return null;
    }

    if (entry.expiresAt && entry.expiresAt < Date.now()) {
      await this.evict(url, 'expired');
      this.emit('miss', { url });
      return null;
    }

    entry.lastAccessed = Date.now();
    entry.accessCount++;
    this.cache.set(url, entry);

    this.emit('hit', { url, entry });
    return entry.localPath;
  }

  async set(url: string, data: ArrayBuffer, options?: CacheWriteOptions): Promise<void> {
    this.ensureInitialized();

    const localPath = `memory://${this.hashUrl(url)}`;
    const entry = this.createEntry(url, localPath, data.byteLength, options);
    this.cache.set(url, entry);

    await this.enforceLimit();
  }

  private hashUrl(url: string): string {
    let hash = 0;
    for (let i = 0; i < url.length; i++) {
      const char = url.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }

  async delete(url: string): Promise<void> {
    this.ensureInitialized();
    this.cache.delete(url);
  }

  async has(url: string): Promise<boolean> {
    this.ensureInitialized();
    const entry = this.cache.get(url);

    if (!entry) return false;

    if (entry.expiresAt && entry.expiresAt < Date.now()) {
      await this.evict(url, 'expired');
      return false;
    }

    return true;
  }

  async getMetadata(url: string): Promise<CacheEntry | null> {
    this.ensureInitialized();
    return this.cache.get(url) ?? null;
  }

  async list(filter?: CacheFilter): Promise<CacheEntry[]> {
    this.ensureInitialized();
    let entries = Array.from(this.cache.values());

    if (filter) {
      if (filter.mimeType) {
        entries = entries.filter((e) => e.mimeType.startsWith(filter.mimeType!));
      }
      if (filter.minSize !== undefined) {
        entries = entries.filter((e) => e.size >= filter.minSize!);
      }
      if (filter.maxSize !== undefined) {
        entries = entries.filter((e) => e.size <= filter.maxSize!);
      }
      if (filter.accessedBefore) {
        entries = entries.filter((e) => e.lastAccessed < filter.accessedBefore!);
      }
      if (filter.accessedAfter) {
        entries = entries.filter((e) => e.lastAccessed > filter.accessedAfter!);
      }
    }

    return entries;
  }

  async clear(): Promise<void> {
    this.ensureInitialized();
    this.cache.clear();
  }

  async getUsage(): Promise<CacheUsage> {
    this.ensureInitialized();
    const entries = Array.from(this.cache.values());

    const byType: CacheUsage['byType'] = {};
    let totalSize = 0;

    for (const entry of entries) {
      totalSize += entry.size;
      const type = entry.mimeType.split('/')[0] ?? 'application';
      if (!byType[type]) {
        byType[type] = { count: 0, size: 0 };
      }
      byType[type]!.count++;
      byType[type]!.size += entry.size;
    }

    return {
      totalSize,
      itemCount: entries.length,
      byType,
    };
  }

  async prune(): Promise<number> {
    this.ensureInitialized();
    return this.doPrune();
  }

  protected async doEvict(_url: string, _reason: EvictReason): Promise<void> {}

  protected async doPrune(): Promise<number> {
    let pruned = 0;
    const usage = await this.getUsage();
    const targetSize = this.config.maxSize * 0.8;

    if (usage.totalSize <= targetSize) return 0;

    let entries = Array.from(this.cache.values()).filter((e) => !e.isPinned);

    switch (this.config.storageStrategy) {
      case 'lru':
        entries.sort((a, b) => a.lastAccessed - b.lastAccessed);
        break;
      case 'lfu':
        entries.sort((a, b) => a.accessCount - b.accessCount);
        break;
      case 'fifo':
        entries.sort((a, b) => a.createdAt - b.createdAt);
        break;
    }

    const now = Date.now();
    for (const entry of entries) {
      if (usage.totalSize - pruned <= targetSize) break;

      const shouldEvict =
        (entry.expiresAt && entry.expiresAt < now) || usage.totalSize > this.config.maxSize;

      if (shouldEvict) {
        await this.evict(entry.url, entry.expiresAt ? 'expired' : 'size-limit');
        pruned += entry.size;
      }
    }

    this.emit('full', { dropped: pruned });
    return pruned;
  }
}
