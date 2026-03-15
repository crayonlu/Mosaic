import { RealmCacheManager } from '../implementations/realm-cache.js';
import type { ICacheManager } from '../types.js';
import { DEFAULT_CACHE_CONFIG } from '../types.js';
import type { AuthHeaderProvider, HttpClient, PlatformAdapter, PlatformType } from './adapter.js';

export class MobilePlatformAdapter implements PlatformAdapter {
  private cacheManager: ICacheManager | null = null;
  private platform: PlatformType = 'mobile';
  private authHeaderProvider: AuthHeaderProvider | null = null;

  async getCacheManager(): Promise<ICacheManager> {
    if (!this.cacheManager) {
      this.cacheManager = new RealmCacheManager();
      await this.cacheManager.initialize(DEFAULT_CACHE_CONFIG.mobile);
    }
    return this.cacheManager;
  }

  setAuthHeaderProvider(provider: AuthHeaderProvider): void {
    this.authHeaderProvider = provider;
  }

  private async getAuthHeaders(): Promise<Record<string, string>> {
    if (this.authHeaderProvider) {
      return await this.authHeaderProvider();
    }
    return {};
  }

  getHttpClient(): HttpClient {
    return {
      get: async (url: string, options?: RequestInit): Promise<Response> => {
        const authHeaders = await this.getAuthHeaders();
        const response = await fetch(url, {
          ...options,
          method: 'GET',
          headers: { ...authHeaders, ...options?.headers },
        });
        return response;
      },
      post: async (url: string, data?: BodyInit, options?: RequestInit): Promise<Response> => {
        const authHeaders = await this.getAuthHeaders();
        const response = await fetch(url, {
          ...options,
          method: 'POST',
          body: data,
          headers: { ...authHeaders, ...options?.headers },
        });
        return response;
      },
    };
  }

  getPlatform(): PlatformType {
    return this.platform;
  }

  async getCacheDir(): Promise<string> {
    return 'cache';
  }

  async fileExists(path: string): Promise<boolean> {
    try {
      const fs = await import('expo-file-system');
      const fileInfo = await fs.getInfoAsync(path);
      return fileInfo.exists;
    } catch {
      return false;
    }
  }

  async readFile(path: string): Promise<Uint8Array> {
    const fs = await import('expo-file-system');
    const content = await fs.readAsStringAsync(path, {
      encoding: fs.EncodingType.Base64,
    });
    const binary = globalThis.atob(content);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }

  async writeFile(path: string, data: Uint8Array): Promise<void> {
    const fs = await import('expo-file-system');
    const dir = path.substring(0, path.lastIndexOf('/'));
    await fs.makeDirectoryAsync(dir, { intermediates: true });
    const binary = Array.from(data)
      .map((byte) => String.fromCharCode(byte))
      .join('');
    const base64 = globalThis.btoa(binary);
    await fs.writeAsStringAsync(path, base64, {
      encoding: fs.EncodingType.Base64,
    });
  }

  async deleteFile(path: string): Promise<void> {
    try {
      const fs = await import('expo-file-system');
      await fs.deleteAsync(path);
    } catch {
      // Ignore errors
    }
  }
}
