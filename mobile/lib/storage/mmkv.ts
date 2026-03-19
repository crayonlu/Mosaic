import { createMMKV } from 'react-native-mmkv'
import type { StateStorage } from 'zustand/middleware'

export const mmkv = createMMKV({ id: 'mosaic-storage' })

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
