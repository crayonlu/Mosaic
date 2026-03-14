import { TauriCacheManager } from '../implementations/tauri-cache.js';
import type { ICacheManager } from '../types.js';
import { DEFAULT_CACHE_CONFIG } from '../types.js';
import type { HttpClient, PlatformAdapter, PlatformType } from './adapter.js';

export class TauriPlatformAdapter implements PlatformAdapter {
  private cacheManager: ICacheManager | null = null;
  private platform: PlatformType = 'desktop';

  async getCacheManager(): Promise<ICacheManager> {
    if (!this.cacheManager) {
      this.cacheManager = new TauriCacheManager();
      await this.cacheManager.initialize(DEFAULT_CACHE_CONFIG.desktop);
    }
    return this.cacheManager;
  }

  getHttpClient(): HttpClient {
    return {
      get: async (url: string, options?: RequestInit): Promise<Response> => {
        const response = await fetch(url, {
          ...options,
          method: 'GET',
        });
        return response;
      },
      post: async (url: string, data?: BodyInit, options?: RequestInit): Promise<Response> => {
        const response = await fetch(url, {
          ...options,
          method: 'POST',
          body: data,
        });
        return response;
      },
    };
  }

  getPlatform(): PlatformType {
    return this.platform;
  }

  async getCacheDir(): Promise<string> {
    try {
      const { appCacheDir, join } = await import('@tauri-apps/api/path');
      const baseDir = await appCacheDir();
      return await join(baseDir, 'mosaic-cache');
    } catch {
      return './mosaic-cache';
    }
  }

  async fileExists(path: string): Promise<boolean> {
    try {
      const { exists } = await import('@tauri-apps/plugin-fs');
      return await exists(path);
    } catch {
      return false;
    }
  }

  async readFile(path: string): Promise<Uint8Array> {
    const { readFile } = await import('@tauri-apps/plugin-fs');
    return await readFile(path);
  }

  async writeFile(path: string, data: Uint8Array): Promise<void> {
    const { writeFile, mkdir, exists } = await import('@tauri-apps/plugin-fs');
    const pathParts = path.split('/');
    const dir = pathParts.slice(0, -1).join('/');

    if (dir && !(await exists(dir))) {
      await mkdir(dir, { recursive: true });
    }

    await writeFile(path, data);
  }

  async deleteFile(path: string): Promise<void> {
    try {
      const { remove } = await import('@tauri-apps/plugin-fs');
      await remove(path);
    } catch {
      // Ignore errors
    }
  }
}
