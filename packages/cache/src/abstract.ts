import type {
  CacheConfig,
  CacheEntry,
  CacheEventHandler,
  CacheEventMap,
  CacheEventType,
  CacheFilter,
  CacheUsage,
  CacheWriteOptions,
  EvictReason,
} from './types.js';

export abstract class AbstractCacheManager {
  protected config!: CacheConfig;
  protected initialized = false;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private handlers: Map<CacheEventType, Set<(event: any) => void>> = new Map();
  abstract initialize(config: CacheConfig): Promise<void>;
  abstract get(url: string): Promise<string | null>;
  abstract set(url: string, data: ArrayBuffer, options?: CacheWriteOptions): Promise<string | null>;
  abstract delete(url: string): Promise<void>;
  abstract has(url: string): Promise<boolean>;
  abstract getMetadata(url: string): Promise<CacheEntry | null>;
  abstract list(filter?: CacheFilter): Promise<CacheEntry[]>;
  abstract clear(): Promise<void>;
  abstract getUsage(): Promise<CacheUsage>;
  abstract prune(): Promise<number>;

  protected abstract doEvict(url: string, reason: EvictReason): Promise<void>;
  protected abstract doPrune(): Promise<number>;

  async touch(url: string): Promise<void> {
    const entry = await this.getMetadata(url);
    if (entry) {
      entry.lastAccessed = Date.now();
      entry.accessCount += 1;
    }
  }

  async evict(url: string, reason: EvictReason = 'manual'): Promise<void> {
    await this.delete(url);
    await this.doEvict(url, reason);
    this.emit('evict', { url, reason });
  }

  async enforceLimit(): Promise<number> {
    const usage = await this.getUsage();
    if (usage.totalSize <= this.config.maxSize * 0.9) return 0;

    return this.doPrune();
  }

  on<T extends CacheEventType>(type: T, handler: CacheEventHandler<T>): () => void {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, new Set());
    }
    this.handlers.get(type)!.add(handler);
    return () => this.handlers.get(type)?.delete(handler);
  }

  protected emit<T extends CacheEventType>(type: T, event: CacheEventMap[T]): void {
    this.handlers.get(type)?.forEach((handler) => handler(event));
  }

  protected emitError(url: string, error: Error): void {
    this.emit('error', { url, error });
  }

  protected ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error('Cache manager not initialized. Call initialize() first.');
    }
  }

  protected createEntry(
    url: string,
    localPath: string,
    size: number,
    options?: CacheWriteOptions
  ): CacheEntry {
    const now = Date.now();
    return {
      url,
      localPath,
      mimeType: options?.mimeType ?? 'application/octet-stream',
      size,
      createdAt: now,
      lastAccessed: now,
      accessCount: 1,
      etag: options?.etag,
      expiresAt: options?.maxAge ? now + options.maxAge : undefined,
      isPinned: options?.isPinned ?? false,
    };
  }

  protected async readEntry(url: string): Promise<CacheEntry | null> {
    const entry = await this.getMetadata(url);
    if (!entry) return null;

    if (entry.expiresAt && entry.expiresAt < Date.now()) {
      await this.evict(url, 'expired');
      return null;
    }

    return entry;
  }
}
