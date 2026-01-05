import AsyncStorage from '@react-native-async-storage/async-storage'
import * as SQLite from 'expo-sqlite'
import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

/**
 * Database State
 * Manages database initialization and readiness state
 */

interface DatabaseState {
  isReady: boolean
  isInitializing: boolean
  error: string | null
}

interface DatabaseStore extends DatabaseState {
  initializeDatabase: () => Promise<void>
  getDatabase: () => Promise<SQLite.SQLiteDatabase | null>
  resetDatabase: () => Promise<void>
  checkReady: () => boolean
}

export const useDatabaseStore = create<DatabaseStore>()(
  persist(
    (set, get) => ({
      isReady: false,
      isInitializing: false,
      error: null,
      initializeDatabase: async () => {
        console.log('[DatabaseStore] Starting database initialization...')
        set({ isInitializing: true, error: null })
        try {
          // Import database module dynamically to avoid circular dependency
          const { getDatabase } = await import('@/lib/database')

          console.log('[DatabaseStore] Calling getDatabase()...')
          const db = await getDatabase()
          console.log('[DatabaseStore] Database instance obtained:', !!db)

          // Wait a bit to ensure database is fully ready
          await new Promise(resolve => setTimeout(resolve, 100))

          console.log('[DatabaseStore] Database initialization complete')
          set({ isReady: true, isInitializing: false })
        } catch (error) {
          console.error('[DatabaseStore] Failed to initialize database:', error)
          set({ isReady: false, isInitializing: false, error: error instanceof Error ? error.message : String(error) })
        }
      },
      getDatabase: async () => {
        const { isReady, error } = get()

        if (error) {
          console.warn('Database has error, returning null')
          return null
        }

        if (!isReady) {
          console.warn('Database not ready, returning null')
          return null
        }

        try {
          const { getDatabase } = await import('@/lib/database')
          return await getDatabase()
        } catch (error) {
          console.error('Failed to get database:', error)
          set({ error: error instanceof Error ? error.message : String(error) })
          return null
        }
      },
      resetDatabase: async () => {
        set({ isReady: false, isInitializing: true, error: null })

        try {
          // Import resetDatabase function
          const { resetDatabase: resetDb } = await import('@/lib/database')

          await resetDb()

          // Wait for database to be ready
          await new Promise(resolve => setTimeout(resolve, 100))

          set({ isReady: true, isInitializing: false })
        } catch (error) {
          console.error('Failed to reset database:', error)
          set({ isReady: false, isInitializing: false, error: error instanceof Error ? error.message : String(error) })
        }
      },
      checkReady: () => {
        const { isReady, error } = get()
        return isReady && !error
      },
    }),
    {
      name: 'mosaic-database-storage',
      storage: createJSONStorage(() => {
        // Use AsyncStorage for persistence
        return {
          getItem: async (key: string) => {
            try {
              return await AsyncStorage.getItem(key)
            } catch (error) {
              console.error('Failed to get item:', error)
              return null
            }
          },
          setItem: async (key: string, value: string) => {
            try {
              await AsyncStorage.setItem(key, value)
            } catch (error) {
              console.error('Failed to set item:', error)
            }
          },
          removeItem: async (key: string) => {
            try {
              await AsyncStorage.removeItem(key)
            } catch (error) {
              console.error('Failed to remove item:', error)
            }
          },
        }
      }),
    }
  )
)
