import { openDB, type DBSchema, type IDBPDatabase } from 'idb'

interface CacheEntry {
  blob: Blob
  timestamp: number
}

interface MosaicCacheDB extends DBSchema {
  images: {
    key: string
    value: CacheEntry
  }
  videos: {
    key: string
    value: CacheEntry
  }
}

const DB_NAME = 'mosaic-resource-cache'
const DB_VERSION = 1

let dbPromise: Promise<IDBPDatabase<MosaicCacheDB>> | null = null

function getDB(): Promise<IDBPDatabase<MosaicCacheDB>> {
  if (!dbPromise) {
    dbPromise = openDB<MosaicCacheDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('images')) {
          db.createObjectStore('images')
        }
        if (!db.objectStoreNames.contains('videos')) {
          db.createObjectStore('videos')
        }
      },
    })
  }
  return dbPromise
}

type CacheType = 'images' | 'videos'

export async function getCachedResource(src: string, type: CacheType): Promise<string | null> {
  try {
    const db = await getDB()
    const entry = await db.get(type, src)
    if (entry) {
      return URL.createObjectURL(entry.blob)
    }
    return null
  } catch {
    return null
  }
}

export async function setCachedResource(src: string, blob: Blob, type: CacheType): Promise<void> {
  try {
    const db = await getDB()
    await db.put(
      type,
      {
        blob,
        timestamp: Date.now(),
      },
      src
    )
  } catch {
    // Silently fail if caching fails
  }
}

export async function clearCache(type?: CacheType): Promise<void> {
  try {
    const db = await getDB()
    if (type) {
      await db.clear(type)
    } else {
      await db.clear('images')
      await db.clear('videos')
    }
  } catch {
    // Silently fail
  }
}

export async function getCacheCount(type: CacheType): Promise<number> {
  try {
    const db = await getDB()
    return await db.count(type)
  } catch {
    return 0
  }
}

// Image-specific helpers (backward compatibility)
export async function getCachedImage(src: string): Promise<string | null> {
  return getCachedResource(src, 'images')
}

export async function setCachedImage(src: string, blob: Blob): Promise<void> {
  return setCachedResource(src, blob, 'images')
}

export async function clearImageCache(): Promise<void> {
  return clearCache('images')
}

export async function getImageCacheCount(): Promise<number> {
  return getCacheCount('images')
}

export async function getCacheSize(type: CacheType): Promise<number> {
  try {
    const db = await getDB()
    const entries = await db.getAll(type)
    return entries.reduce((total, entry) => total + entry.blob.size, 0)
  } catch {
    return 0
  }
}

export async function getVideoCacheSize(): Promise<number> {
  return getCacheSize('videos')
}
