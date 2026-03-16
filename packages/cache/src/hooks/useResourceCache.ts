import { useCallback, useEffect, useState } from 'react';
import type { ResourceLoader } from '../services/resourceLoader';

function isRenderableLocalUri(uri: string): boolean {
  return /^(file|content|asset|data):/i.test(uri) || /^https?:/i.test(uri);
}

/**
 * Hook for caching resources using ResourceLoader
 * This provides a reusable way to load and cache images/videos
 */
export function useResourceCache(
  urls: string[],
  options?: { forceRefresh?: boolean }
): {
  cachedUris: Record<string, string>;
  getCachedUri: (url: string) => string;
  isLoading: boolean;
} {
  const [cachedUris, setCachedUris] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);

  const getCachedUri = useCallback(
    (url: string): string => {
      return cachedUris[url] || url;
    },
    [cachedUris]
  );

  useEffect(() => {
    if (!urls.length) return;

    let isMounted = true;
    let resourceLoader: ResourceLoader | null = null;

    const loadCache = async () => {
      try {
        const { ResourceLoader } = await import('../services/resourceLoader');

        if (!resourceLoader) {
          resourceLoader = new ResourceLoader();
          await resourceLoader.initialize();
        }

        if (!isMounted) return;

        setIsLoading(true);
        const newCachedUris: Record<string, string> = {};

        const loadPromises = urls.map(async (url) => {
          try {
            const result = await resourceLoader!.load(url, {
              forceRefresh: options?.forceRefresh ?? false,
              allowCache: true,
            });
            if (result.path) {
              if (!isRenderableLocalUri(result.path)) return;

              newCachedUris[url] = result.path;
            }
          } catch {
            // Fall back to original URL on error
          }
        });

        await Promise.all(loadPromises);

        if (isMounted) {
          setCachedUris(newCachedUris);
          setIsLoading(false);
        }
      } catch {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadCache();

    return () => {
      isMounted = false;
    };
  }, [urls, options?.forceRefresh]);

  return {
    cachedUris,
    getCachedUri,
    isLoading,
  };
}
