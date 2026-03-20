import { useCallback, useEffect, useState } from 'react';
import { getResourceLoader, type ResourceLoader } from '../services/resourceLoader';

function isRenderableLocalUri(uri: string): boolean {
  return /^(file|content|asset|data):/i.test(uri) || /^https?:/i.test(uri);
}

const INITIALIZATION_POLL_INTERVAL = 100;
const MAX_INITIALIZATION_WAIT = 1500;

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
    if (!urls.length) {
      return;
    }

    let isMounted = true;
    let cancelled = false;
    let loader: ResourceLoader | null = null;

    const fallbackUris: Record<string, string> = {};
    for (const url of urls) {
      if (isRenderableLocalUri(url)) {
        fallbackUris[url] = url;
      }
    }
    const fallbackKeys = Object.keys(fallbackUris);
    if (fallbackKeys.length > 0) {
      setCachedUris(fallbackUris);
    }

    const loadCache = async () => {
      try {
        const startTime = Date.now();

        while (Date.now() - startTime < MAX_INITIALIZATION_WAIT) {
          try {
            const obtainedLoader = await getResourceLoader();
            if (obtainedLoader) {
              loader = obtainedLoader;
              break;
            }
          } catch {
            // wait for loader to be initialized
          }
          await new Promise((resolve) => setTimeout(resolve, INITIALIZATION_POLL_INTERVAL));
        }

        if (cancelled || !isMounted) {
          return;
        }

        if (!loader) {
          return;
        }

        setIsLoading(true);
        const newCachedUris: Record<string, string> = {};

        const loadPromises = urls.map(async (url) => {
          try {
            const result = await loader!.load(url, {
              forceRefresh: options?.forceRefresh ?? false,
              allowCache: true,
            });

            if (result.path && isRenderableLocalUri(result.path)) {
              newCachedUris[url] = result.path;
            }
          } catch (error) {
            console.warn('[useResourceCache] Failed to load URL:', url, error);
          }
        });

        await Promise.all(loadPromises).catch(() => {
          // Ignore individual load errors
        });

        if (isMounted && !cancelled) {
          setCachedUris((prev) => ({ ...prev, ...newCachedUris }));
          setIsLoading(false);
        }
      } catch (error) {
        console.error('[useResourceCache] Unexpected error:', error);
        if (isMounted && !cancelled) {
          setIsLoading(false);
        }
      }
    };

    loadCache();

    return () => {
      isMounted = false;
      cancelled = true;
    };
  }, [urls, options?.forceRefresh]);

  return {
    cachedUris,
    getCachedUri,
    isLoading,
  };
}
