import { AbstractCacheManager } from '../abstract.js';
import type {
  CacheConfig,
  CacheEntry,
  CacheFilter,
  CacheUsage,
  CacheWriteOptions,
  EvictReason,
} from '../types.js';

const TextEncoder = globalThis.TextEncoder;
const TextDecoder = globalThis.TextDecoder;

export class TauriCacheManager extends AbstractCacheManager {
  private cacheDir = '';
  private indexPath = '';
  private index: Map<string, CacheEntry> = new Map();

  async initialize(config: CacheConfig): Promise<void> {
    this.config = config;

    const hasTauri = this.detectTauri();
    if (!hasTauri) {
      this.cacheDir = './mosaic-cache';
      this.indexPath = './mosaic-cache/index.json';
    } else {
      const { appCacheDir, join } = await import('@tauri-apps/api/path');
      const baseDir = await appCacheDir();
      this.cacheDir = await join(baseDir, 'mosaic-cache');
      this.indexPath = await join(this.cacheDir, 'index.json');
    }

    await this.ensureCacheDir();
    await this.loadIndex();

    this.initialized = true;
    await this.enforceLimit();
  }

  private detectTauri(): boolean {
    return typeof window !== 'undefined' && '__TAURI__' in window;
  }

  private async ensureCacheDir(): Promise<void> {
    const hasFs = await this.hasFileSystem();
    if (!hasFs) return;

    const { exists, mkdir } = await import('@tauri-apps/plugin-fs');
    if (!(await exists(this.cacheDir))) {
      await mkdir(this.cacheDir, { recursive: true });
    }

    const imagesDir = await this.joinPath(this.cacheDir, 'images');
    const videosDir = await this.joinPath(this.cacheDir, 'videos');
    const tempDir = await this.joinPath(this.cacheDir, 'temp');

    for (const dir of [imagesDir, videosDir, tempDir]) {
      if (!(await exists(dir))) {
        await mkdir(dir, { recursive: true });
      }
    }
  }

  private async hasFileSystem(): Promise<boolean> {
    try {
      await import('@tauri-apps/plugin-fs');
      return true;
    } catch {
      return false;
    }
  }

  private async joinPath(...parts: string[]): Promise<string> {
    try {
      const { join } = await import('@tauri-apps/api/path');
      return join(...parts);
    } catch {
      return parts.join('/');
    }
  }

  private async loadIndex(): Promise<void> {
    const hasFs = await this.hasFileSystem();
    if (!hasFs) return;

    try {
      const { exists, readFile } = await import('@tauri-apps/plugin-fs');
      if (await exists(this.indexPath)) {
        const data = await readFile(this.indexPath);
        const parsed = JSON.parse(new TextDecoder().decode(data));
        this.index = new Map(Object.entries(parsed));
      }
    } catch {
      this.index = new Map();
    }
  }

  private async saveIndex(): Promise<void> {
    const hasFs = await this.hasFileSystem();
    if (!hasFs) return;

    try {
      const { writeFile } = await import('@tauri-apps/plugin-fs');
      const data = JSON.stringify(Object.fromEntries(this.index));
      await writeFile(this.indexPath, new TextEncoder().encode(data));
    } catch {
      // Silently fail
    }
  }

  private getFilePath(url: string): string {
    const hash = this.hashUrl(url);
    const ext = this.getExtension(url);
    return `${hash}.${ext}`;
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

  private getExtension(url: string): string {
    const match = url.match(/\.([^./?#]+)(?:[?#]|$)/);
    return match ? match[1]!.toLowerCase() : 'bin';
  }

  private getStorageDir(mimeType: string): string {
    if (mimeType.startsWith('image/')) return 'images';
    if (mimeType.startsWith('video/')) return 'videos';
    return 'temp';
  }

  async get(url: string): Promise<string | null> {
    this.ensureInitialized();
    const entry = await this.getMetadata(url);

    if (!entry) {
      this.emit('miss', { url });
      return null;
    }

    const fileExists = await this.fileExists(entry.localPath);
    if (!fileExists) {
      await this.delete(url);
      this.emit('miss', { url });
      return null;
    }

    entry.lastAccessed = Date.now();
    entry.accessCount += 1;
    this.index.set(url, entry);
    await this.saveIndex();

    this.emit('hit', { url, entry });
    return entry.localPath;
  }

  private async fileExists(path: string): Promise<boolean> {
    try {
      const { exists } = await import('@tauri-apps/plugin-fs');
      return await exists(path);
    } catch {
      return false;
    }
  }

  async set(url: string, data: ArrayBuffer, options?: CacheWriteOptions): Promise<string | null> {
    this.ensureInitialized();

    const dir = this.getStorageDir(options?.mimeType ?? 'application/octet-stream');
    const fullDir = await this.joinPath(this.cacheDir, dir);
    const filename = this.getFilePath(url);
    const localPath = await this.joinPath(fullDir, filename);

    try {
      const { writeFile } = await import('@tauri-apps/plugin-fs');
      await writeFile(localPath, new Uint8Array(data));
    } catch {
      // Fallback: skip file write in test environment
    }

    const entry = this.createEntry(url, localPath, data.byteLength, options);
    this.index.set(url, entry);
    await this.saveIndex();

    await this.enforceLimit();

    return localPath;
  }

  async delete(url: string): Promise<void> {
    this.ensureInitialized();
    const entry = this.index.get(url);

    if (entry) {
      try {
        const { exists, remove } = await import('@tauri-apps/plugin-fs');
        if (await exists(entry.localPath)) {
          await remove(entry.localPath);
        }
      } catch {
        // Ignore file removal errors
      }
      this.index.delete(url);
      await this.saveIndex();
    }
  }

  async has(url: string): Promise<boolean> {
    this.ensureInitialized();
    const entry = this.index.get(url);
    if (!entry) return false;

    if (entry.expiresAt && entry.expiresAt < Date.now()) {
      await this.delete(url);
      return false;
    }

    return this.fileExists(entry.localPath);
  }

  async getMetadata(url: string): Promise<CacheEntry | null> {
    this.ensureInitialized();
    return this.index.get(url) ?? null;
  }

  async list(filter?: CacheFilter): Promise<CacheEntry[]> {
    this.ensureInitialized();
    let entries = Array.from(this.index.values());

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

    for (const entry of this.index.values()) {
      try {
        const { exists, remove } = await import('@tauri-apps/plugin-fs');
        if (await exists(entry.localPath)) {
          await remove(entry.localPath);
        }
      } catch {
        // Ignore errors
      }
    }

    this.index.clear();
    await this.saveIndex();
  }

  async getUsage(): Promise<CacheUsage> {
    this.ensureInitialized();
    const entries = Array.from(this.index.values());

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

  protected async doEvict(_url: string, _reason: EvictReason): Promise<void> {
    // Already handled in delete
  }

  protected async doPrune(): Promise<number> {
    let pruned = 0;
    const usage = await this.getUsage();
    const targetSize = this.config.maxSize * 0.8;

    if (usage.totalSize <= targetSize) return 0;

    let entries = Array.from(this.index.values()).filter((e) => !e.isPinned);

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

      if (entry.expiresAt && entry.expiresAt < now) {
        await this.evict(entry.url, 'expired');
        pruned += entry.size;
      } else if (usage.totalSize > this.config.maxSize) {
        await this.evict(entry.url, 'size-limit');
        pruned += entry.size;
      }
    }

    this.emit('full', { dropped: pruned });
    return pruned;
  }
}
