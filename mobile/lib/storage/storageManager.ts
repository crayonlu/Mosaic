import i18n from '@/lib/i18n'
import { getDatabase } from './database'
import { mmkv } from './mmkv'

export interface StorageItem {
  id: string
  label: string
  description: string
  size: number
  itemCount?: number
  clearable: boolean
  clear: () => Promise<void>
}

export interface StorageSummary {
  totalSize: number
  items: StorageItem[]
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return i18n.t('storage.zeroBytes', { defaultValue: '0 B' })
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

function getMMKVStorage(): StorageItem {
  const size = mmkv.byteSize ?? 0
  const keyCount = mmkv.getAllKeys().length

  return {
    id: 'mmkv',
    label: i18n.t('storage.appStateLabel'),
    description: i18n.t('storage.appState', { count: keyCount }),
    size,
    itemCount: keyCount,
    clearable: false,
    clear: async () => {
      throw new Error('MMKV storage cannot be cleared separately, will be cleared on logout')
    },
  }
}

function getSecureStorage(): StorageItem {
  return {
    id: 'secure',
    label: i18n.t('storage.secureLabel'),
    description: i18n.t('storage.secureDesc'),
    size: 0,
    clearable: false,
    clear: async () => {
      throw new Error('Secure credentials must be cleared via logout')
    },
  }
}

async function getSQLiteStorage(): Promise<StorageItem> {
  try {
    const db = await getDatabase()

    let size = 0
    try {
      const pageCount = (await db.getFirstAsync('PRAGMA page_count')) as { page_count?: number }
      const pageSize = (await db.getFirstAsync('PRAGMA page_size')) as { page_size?: number }
      if (pageCount?.page_count != null && pageSize?.page_size != null) {
        size = pageCount.page_count * pageSize.page_size
      }
    } catch {}

    let memoCount = 0
    let diaryCount = 0
    let resourceCount = 0
    try {
      const memoRow = (await db.getFirstAsync('SELECT COUNT(*) as c FROM memos')) as { c?: number }
      const diaryRow = (await db.getFirstAsync('SELECT COUNT(*) as c FROM diaries')) as {
        c?: number
      }
      const resourceRow = (await db.getFirstAsync('SELECT COUNT(*) as c FROM resources')) as {
        c?: number
      }
      memoCount = memoRow?.c ?? 0
      diaryCount = diaryRow?.c ?? 0
      resourceCount = resourceRow?.c ?? 0
    } catch {}

    const totalRows = memoCount + diaryCount + resourceCount

    return {
      id: 'sqlite',
      label: i18n.t('storage.dbLabel'),
      description: i18n.t('storage.dbDesc', { count: totalRows }),
      size,
      itemCount: totalRows,
      clearable: totalRows > 0,
      clear: async () => {
        const db = await getDatabase()
        await db.runAsync('DELETE FROM memo_tags')
        await db.runAsync('DELETE FROM resources')
        await db.runAsync('DELETE FROM memos')
        await db.runAsync('DELETE FROM diaries')
        await db.runAsync('DELETE FROM stats_daily')
      },
    }
  } catch (error) {
    console.error('[getSQLiteStorage] Failed to get SQLite storage info:', error)
    return {
      id: 'sqlite',
      label: i18n.t('storage.dbLabel'),
      description: i18n.t('storage.dbDesc'),
      size: 0,
      itemCount: 0,
      clearable: false,
      clear: async () => {
        throw new Error('Database unavailable')
      },
    }
  }
}

export async function getStorageSummary(): Promise<StorageSummary> {
  const [mmkvItem, secureItem, sqliteItem] = await Promise.all([
    Promise.resolve(getMMKVStorage()),
    Promise.resolve(getSecureStorage()),
    getSQLiteStorage(),
  ])

  const items = [mmkvItem, secureItem, sqliteItem]
  const totalSize = items.reduce((sum, i) => sum + i.size, 0)

  return {
    totalSize,
    items,
  }
}

export { formatBytes }
