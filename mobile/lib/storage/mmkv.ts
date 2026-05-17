import type { StateStorage } from 'zustand/middleware'

type MMKVInstance = ReturnType<(typeof import('react-native-mmkv'))['createMMKV']>

function createFallbackMMKV(): MMKVInstance {
  const store = new Map<string, string>()

  const fallback = {
    getString: (key: string) => store.get(key),
    set: (key: string, value: string) => {
      store.set(key, value)
    },
    remove: (key: string) => {
      store.delete(key)
    },
    getAllKeys: () => Array.from(store.keys()),
    byteSize: 0,
    contains: (key: string) => store.has(key),
    clearAll: () => store.clear(),
    clearCache: () => {},
    isInstalled: true,
    addOnValueChangedCallback: () => () => {},
    removeOnValueChangedCallback: () => {},
    recalculateMD5: () => '',
    toBase64: () => '',
    toString: () => '',
    getBoolean: (key: string) => {
      const v = store.get(key)
      if (v === undefined) return undefined
      return v === 'true'
    },
    getNumber: (key: string) => {
      const v = store.get(key)
      if (v === undefined) return undefined
      return Number(v)
    },
    setAsync: async (key: string, value: string) => {
      store.set(key, value)
    },
    getStringAsync: async (key: string) => store.get(key),
    deleteAll: () => store.clear(),
  }

  return fallback as unknown as MMKVInstance
}

let mmkvInstance: MMKVInstance

try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mmkvModule = require('react-native-mmkv') as typeof import('react-native-mmkv')
  mmkvInstance = mmkvModule.createMMKV({ id: 'mosaic-storage' })
} catch {
  console.warn(
    '[MMKV] react-native-mmkv not available in Expo Go, using in-memory fallback. Data will not persist.'
  )
  mmkvInstance = createFallbackMMKV()
}

export const mmkv = mmkvInstance

/**
 * Zustand-compatible StateStorage backed by MMKV.
 * Synchronous under the hood but returns Promises to satisfy the interface.
 */
export const mmkvZustandStorage: StateStorage = {
  getItem(name: string) {
    return mmkv.getString(name) ?? null
  },
  setItem(name: string, value: string) {
    mmkv.set(name, value)
  },
  removeItem(name: string) {
    mmkv.remove(name)
  },
}
