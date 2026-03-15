import type { CacheEntry, StorageStrategy } from '../types';

export const compareByLRU = (a: CacheEntry, b: CacheEntry): number =>
  a.lastAccessed - b.lastAccessed;

export const compareByLFU = (a: CacheEntry, b: CacheEntry): number => a.accessCount - b.accessCount;

export const compareByFIFO = (a: CacheEntry, b: CacheEntry): number => a.createdAt - b.createdAt;

export const sortEntries = (entries: CacheEntry[], strategy: StorageStrategy): CacheEntry[] => {
  const sorted = [...entries];
  switch (strategy) {
    case 'lru':
      return sorted.sort(compareByLRU);
    case 'lfu':
      return sorted.sort(compareByLFU);
    case 'fifo':
      return sorted.sort(compareByFIFO);
    default:
      return sorted.sort(compareByLRU);
  }
};

export const filterNotExpired = (entries: CacheEntry[], now: number = Date.now()): CacheEntry[] =>
  entries.filter((e) => e.expiresAt === undefined || e.expiresAt > now);

export const filterUnpinned = (entries: CacheEntry[]): CacheEntry[] =>
  entries.filter((e) => !e.isPinned);

export const calculateTotalSize = (entries: CacheEntry[]): number =>
  entries.reduce((sum, e) => sum + e.size, 0);

export const selectEvictionCandidates = (
  entries: CacheEntry[],
  strategy: StorageStrategy,
  targetSize: number,
  now: number = Date.now()
): CacheEntry[] => {
  const unpinned = filterUnpinned(entries);
  const sorted = sortEntries(unpinned, strategy);
  const candidates: CacheEntry[] = [];

  let currentSize = calculateTotalSize(entries);

  // First pass: evict all expired entries (regardless of policy order)
  const expired: CacheEntry[] = [];
  const notExpired: CacheEntry[] = [];
  for (const entry of sorted) {
    if (entry.expiresAt && entry.expiresAt < now) {
      expired.push(entry);
    } else {
      notExpired.push(entry);
    }
  }

  // Add expired entries first
  for (const entry of expired) {
    if (currentSize <= targetSize) break;
    candidates.push(entry);
    currentSize -= entry.size;
  }

  // Second pass: if still over target, evict by policy regardless of expiration
  for (const entry of notExpired) {
    if (currentSize <= targetSize) break;
    candidates.push(entry);
    currentSize -= entry.size;
  }

  return candidates;
};

export const parseMaxAge = (header: string | null): number | undefined => {
  if (!header) return undefined;
  const match = header.match(/max-age=(\d+)/);
  return match ? parseInt(match[1]!, 10) * 1000 : undefined;
};

export const parseExpires = (header: string | null): number | undefined => {
  if (!header) return undefined;
  const date = new Date(header);
  return isNaN(date.getTime()) ? undefined : date.getTime();
};

export const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
};

// Backward compatibility aliases
export { filterNotExpired as filterExpired, filterUnpinned as filterPinned };
