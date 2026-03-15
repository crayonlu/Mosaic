import { getCacheManager, getPlatformAdapter, type PlatformAdapter } from '../platform/adapter';
import type { CacheEntry, ICacheManager, LoadedResource } from '../types';
import { parseMaxAge } from '../utils/policy';

export interface ResourceLoaderOptions {
  forceRefresh?: boolean;
  allowOffline?: boolean;
  allowCache?: boolean;
}

export class ResourceLoader {
  private cacheManager: ICacheManager | null = null;
  private platformAdapter: PlatformAdapter | null = null;

  async initialize(): Promise<void> {
    this.cacheManager = await getCacheManager();
    this.platformAdapter = getPlatformAdapter();
  }

  async load(url: string, options?: ResourceLoaderOptions): Promise<LoadedResource> {
    const { forceRefresh = false, allowOffline = true, allowCache = true } = options ?? {};

    if (allowCache && !forceRefresh && this.cacheManager) {
      const cachedPath = await this.cacheManager.get(url);
      if (cachedPath) {
        await this.cacheManager.touch(url);
        return { source: 'cache', path: cachedPath };
      }
    }

    if (!this.platformAdapter) {
      throw new Error('Platform adapter not initialized');
    }

    const httpClient = this.platformAdapter.getHttpClient();

    try {
      const metadata = allowCache ? await this.cacheManager?.getMetadata(url) : null;
      const headers: Record<string, string> = {};

      if (metadata?.etag) {
        headers['If-None-Match'] = metadata.etag;
      }

      const response = await httpClient.get(url, { headers });

      if (response.status === 304 && allowCache) {
        await this.cacheManager?.touch(url);
        const cachedPath = await this.cacheManager?.get(url);
        if (cachedPath) {
          return { source: 'cache', path: cachedPath };
        }
      }

      if (!response.ok) {
        throw new Error(`HTTP error: ${response.status}`);
      }

      const data = await response.arrayBuffer();
      const mimeType = response.headers.get('Content-Type') ?? 'application/octet-stream';
      const cacheControl = response.headers.get('Cache-Control');
      const etag = response.headers.get('ETag');
      const maxAge = parseMaxAge(cacheControl);

      let localPath: string | null = null;

      if (allowCache && this.cacheManager) {
        localPath = await this.cacheManager.set(url, data, {
          mimeType,
          etag: etag ?? undefined,
          maxAge: maxAge ?? undefined,
        });
      }

      if (localPath) {
        return { source: 'network', data, path: localPath };
      }

      if (this.platformAdapter) {
        const cacheDir = await this.platformAdapter.getCacheDir();
        const fileName = this.getFileNameFromUrl(url);
        const fallbackPath = `${cacheDir}/${fileName}`;

        await this.platformAdapter.writeFile(fallbackPath, new Uint8Array(data));

        return { source: 'network', data, path: fallbackPath };
      }

      return { source: 'network', data };
    } catch (error) {
      if (allowOffline) {
        const cachedPath = await this.cacheManager?.get(url);
        if (cachedPath) {
          return { source: 'offline', path: cachedPath };
        }
      }
      throw error;
    }
  }

  async prefetch(
    urls: string[],
    options?: { concurrency?: number; delayMs?: number }
  ): Promise<void> {
    const { concurrency = 3, delayMs = 1000 } = options ?? {};
    const queue = [...urls];

    const processNext = async (): Promise<void> => {
      while (queue.length > 0) {
        const url = queue.shift();
        if (!url) break;

        try {
          await this.load(url, { allowCache: true });
        } catch {
          // Ignore individual prefetch failures
        }

        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    };

    const workers = Array.from({ length: Math.min(concurrency, urls.length) }, () => processNext());

    await Promise.all(workers);
  }

  async clearCache(): Promise<void> {
    await this.cacheManager?.clear();
  }

  async getCacheUsage() {
    return this.cacheManager?.getUsage();
  }

  async getCachedMetadata(url: string): Promise<CacheEntry | null> {
    return this.cacheManager?.getMetadata(url) ?? null;
  }

  async isCached(url: string): Promise<boolean> {
    return this.cacheManager?.has(url) ?? false;
  }

  private getFileNameFromUrl(url: string): string {
    try {
      const urlObj = new URL(url);
      const pathParts = urlObj.pathname.split('/');
      const fileName = pathParts[pathParts.length - 1];
      if (fileName && fileName.includes('.')) {
        return fileName;
      }
    } catch {
      // Fallback
    }
    const hash = this.hashCode(url);
    const ext = this.getExtension(url);
    return `${hash}.${ext}`;
  }

  private hashCode(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }

  private getExtension(url: string): string {
    const match = url.match(/\.([^./?#]+)(?:[?#]|$)/);
    return match ? match[1]!.toLowerCase() : 'bin';
  }
}

let resourceLoader: ResourceLoader | null = null;

export const getResourceLoader = async (): Promise<ResourceLoader> => {
  if (!resourceLoader) {
    resourceLoader = new ResourceLoader();
    await resourceLoader.initialize();
  }
  return resourceLoader;
};

export const resetResourceLoader = (): void => {
  resourceLoader = null;
};
