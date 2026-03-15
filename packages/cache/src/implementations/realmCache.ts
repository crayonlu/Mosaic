import { AbstractCacheManager } from '../abstract';
import type {
  CacheConfig,
  CacheEntry,
  CacheFilter,
  CacheUsage,
  CacheWriteOptions,
  EvictReason,
} from '../types';

interface RealmObject {
  url: string;
  localPath: string;
  mimeType: string;
  fileSize: number;
  etag: string | null;
  createdAt: Date;
  lastAccessed: Date;
  accessCount: number;
  expiresAt: Date | null;
  isPinned: boolean;
}

interface RealmClass {
  open(config: { schema: object[]; schemaVersion: number }): Promise<RealmInstance>;
  UpdateMode: {
    Modified: string;
  };
}

interface RealmInstance {
  objectForPrimaryKey<T>(name: string, key: string): T | null;
  objects<T>(name: string): RealmResults<T>;
  write(callback: () => void): void;
  create<T>(name: string, obj: T, mode?: { Modified: string }): void;
  delete(obj: unknown): void;
}

interface RealmResults<T> {
  filtered(query: string, ...args: unknown[]): RealmResults<T>;
  sorted(property: string): RealmResults<T>;
  length: number;
  [Symbol.iterator](): Iterator<T>;
}

let Realm: RealmClass | null = null;

const initRealm = async (): Promise<RealmClass> => {
  if (!Realm) {
    try {
      const realmModule = await import('realm');
      Realm = realmModule.default as RealmClass;
    } catch {
      throw new Error('Realm is not installed. Run: bun add realm');
    }
  }
  return Realm!;
};

const ResourceCacheSchema = {
  name: 'ResourceCache',
  primaryKey: 'url',
  properties: {
    url: 'string',
    localPath: 'string',
    mimeType: 'string',
    fileSize: 'int',
    etag: 'string?',
    createdAt: 'date',
    lastAccessed: 'date',
    accessCount: 'int',
    expiresAt: 'date?',
    isPinned: 'bool',
  },
};

export class RealmCacheManager extends AbstractCacheManager {
  private realm: RealmInstance | null = null;
  private maxSize: number = 512 * 1024 * 1024;

  async initialize(config: CacheConfig): Promise<void> {
    this.config = config;
    this.maxSize = config.maxSize;

    const RealmClass = await initRealm();
    this.realm = await RealmClass.open({
      schema: [ResourceCacheSchema],
      schemaVersion: 1,
    });

    this.initialized = true;
    await this.enforceLimit();
  }

  private toEntry(realmObj: RealmObject): CacheEntry {
    return {
      url: realmObj.url,
      localPath: realmObj.localPath,
      mimeType: realmObj.mimeType,
      size: realmObj.fileSize,
      createdAt: realmObj.createdAt.getTime(),
      lastAccessed: realmObj.lastAccessed.getTime(),
      accessCount: realmObj.accessCount,
      etag: realmObj.etag ?? undefined,
      expiresAt: realmObj.expiresAt?.getTime(),
      isPinned: realmObj.isPinned,
    };
  }

  async get(url: string): Promise<string | null> {
    this.ensureInitialized();
    const cached = this.realm!.objectForPrimaryKey<RealmObject>('ResourceCache', url);

    if (!cached) {
      this.emit('miss', { url });
      return null;
    }

    if (cached.expiresAt && cached.expiresAt < new Date()) {
      await this.evict(url, 'expired');
      this.emit('miss', { url });
      return null;
    }

    this.realm!.write(() => {
      cached.lastAccessed = new Date();
      cached.accessCount += 1;
    });

    const entry = this.toEntry(cached);
    this.emit('hit', { url, entry });
    return cached.localPath;
  }

  async touch(url: string): Promise<void> {
    this.ensureInitialized();
    const cached = this.realm!.objectForPrimaryKey<RealmObject>('ResourceCache', url);
    if (!cached) return;

    this.realm!.write(() => {
      cached.lastAccessed = new Date();
      cached.accessCount += 1;
    });
  }

  async set(url: string, data: ArrayBuffer, options?: CacheWriteOptions): Promise<string | null> {
    this.ensureInitialized();

    const now = new Date();
    const expiresAt = options?.maxAge ? new Date(now.getTime() + options.maxAge) : null;
    const localPath = `cache/${this.hashUrl(url)}`;

    this.realm!.write(() => {
      this.realm!.create(
        'ResourceCache',
        {
          url,
          localPath,
          mimeType: options?.mimeType ?? 'application/octet-stream',
          fileSize: data.byteLength,
          etag: options?.etag ?? null,
          createdAt: now,
          lastAccessed: now,
          accessCount: 1,
          expiresAt,
          isPinned: options?.isPinned ?? false,
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        { Modified: 'modified' } as any
      );
    });

    await this.enforceLimit();

    return localPath;
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
    const cached = this.realm!.objectForPrimaryKey<RealmObject>('ResourceCache', url);

    if (cached) {
      this.realm!.write(() => {
        this.realm!.delete(cached);
      });
    }
  }

  async has(url: string): Promise<boolean> {
    this.ensureInitialized();
    const cached = this.realm!.objectForPrimaryKey<RealmObject>('ResourceCache', url);

    if (!cached) return false;

    if (cached.expiresAt && cached.expiresAt < new Date()) {
      await this.evict(url, 'expired');
      return false;
    }

    return true;
  }

  async getMetadata(url: string): Promise<CacheEntry | null> {
    this.ensureInitialized();
    const cached = this.realm!.objectForPrimaryKey<RealmObject>('ResourceCache', url);
    return cached ? this.toEntry(cached) : null;
  }

  async list(filter?: CacheFilter): Promise<CacheEntry[]> {
    this.ensureInitialized();
    let results: RealmResults<RealmObject> = this.realm!.objects<RealmObject>('ResourceCache');

    if (filter?.mimeType) {
      results = results.filtered('mimeType BEGINSWITH $0', filter.mimeType);
    }
    if (filter?.minSize !== undefined) {
      results = results.filtered('fileSize >= $0', filter.minSize);
    }
    if (filter?.maxSize !== undefined) {
      results = results.filtered('fileSize <= $0', filter.maxSize);
    }
    if (filter?.accessedBefore) {
      results = results.filtered('lastAccessed < $0', new Date(filter.accessedBefore));
    }
    if (filter?.accessedAfter) {
      results = results.filtered('lastAccessed > $0', new Date(filter.accessedAfter));
    }

    return Array.from(results).map((obj) => this.toEntry(obj));
  }

  async clear(): Promise<void> {
    this.ensureInitialized();
    this.realm!.write(() => {
      const all = this.realm!.objects<RealmObject>('ResourceCache');
      this.realm!.delete(all);
    });
  }

  async getUsage(): Promise<CacheUsage> {
    this.ensureInitialized();
    const all = this.realm!.objects<RealmObject>('ResourceCache');

    const byType: CacheUsage['byType'] = {};
    let totalSize = 0;

    for (const obj of all) {
      totalSize += obj.fileSize;
      const type = obj.mimeType.split('/')[0] ?? 'application';
      if (!byType[type]) {
        byType[type] = { count: 0, size: 0 };
      }
      byType[type]!.count++;
      byType[type]!.size += obj.fileSize;
    }

    return {
      totalSize,
      itemCount: all.length,
      byType,
    };
  }

  async prune(): Promise<number> {
    this.ensureInitialized();
    return this.doPrune();
  }

  protected async doEvict(_url: string, _reason: EvictReason): Promise<void> {}

  protected async doPrune(): Promise<number> {
    const usage = await this.getUsage();
    const targetSize = this.maxSize * 0.8;

    if (usage.totalSize <= targetSize) return 0;

    let candidates = this.realm!.objects<RealmObject>('ResourceCache')
      .filtered('isPinned == false')
      .sorted('lastAccessed');

    let pruned = 0;
    const now = Date.now();

    this.realm!.write(() => {
      for (const item of candidates) {
        if (usage.totalSize - pruned <= targetSize) break;

        const shouldEvict =
          (item.expiresAt && item.expiresAt.getTime() < now) || usage.totalSize > this.maxSize;

        if (shouldEvict) {
          this.realm!.delete(item);
          pruned += item.fileSize;
        }
      }
    });

    this.emit('full', { dropped: pruned });
    return pruned;
  }
}
