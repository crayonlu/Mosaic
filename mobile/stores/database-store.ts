import AsyncStorage from '@react-native-async-storage/async-storage'
import * as SQLite from 'expo-sqlite'
import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

// ============================================================================
// Configuration
// ============================================================================

const DATABASE_NAME = 'mosaic.db'
const DATABASE_VERSION = 3 // Match the number of migration files

// ============================================================================
// Migration SQL Statements
// ============================================================================

const MIGRATION_V1 = `
-- Enable foreign key constraints
PRAGMA foreign_keys = ON;

-- diaries table
CREATE TABLE IF NOT EXISTS diaries (
  date TEXT PRIMARY KEY NOT NULL,

  -- Summary of the day
  summary TEXT NOT NULL DEFAULT '',

  -- Mood of the day
  mood_key TEXT NOT NULL,
  -- emotional concentration
  mood_score INTEGER NOT NULL DEFAULT 50,

  -- cover image(optional)
  cover_image_id TEXT,
  -- memo count(that day contains how many memos)
  memo_count INTEGER NOT NULL DEFAULT 0,

  -- created at(ms)
  created_at INTEGER NOT NULL,
  -- updated at(ms)(for sync)
  updated_at INTEGER NOT NULL
);

-- memos table
CREATE TABLE IF NOT EXISTS memos (
  id TEXT PRIMARY KEY NOT NULL,

  -- content of memo
  content TEXT NOT NULL DEFAULT '',
  -- content format: 'plain' or 'html'
  contentFormat TEXT NOT NULL DEFAULT 'plain',
  -- tags
  tags TEXT NOT NULL DEFAULT '[]',

  -- is archived
  is_archived BOOLEAN NOT NULL DEFAULT 0,
  -- is deleted
  is_deleted BOOLEAN NOT NULL DEFAULT 0,

  diary_date TEXT,

  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- resources table
CREATE TABLE IF NOT EXISTS resources (
  id TEXT PRIMARY KEY NOT NULL,
  memo_id TEXT,

  filename TEXT NOT NULL,
  -- 'image', 'voice', 'video'
  resource_type TEXT NOT NULL,
  -- 'image/webp', 'audio/mp4'(for frontend display)
  mime_type TEXT NOT NULL,
  size INTEGER NOT NULL DEFAULT 0,

  created_at INTEGER NOT NULL,
  FOREIGN KEY (memo_id) REFERENCES memos(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_memos_inbox ON memos(is_archived, is_deleted, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_resources_memo ON resources(memo_id);
`

const MIGRATION_V2 = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY NOT NULL,
  username TEXT NOT NULL DEFAULT 'new user',
  avatar_path TEXT,
  avatar_url TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
`

const MIGRATION_V3 = `
-- Enable foreign key constraints
PRAGMA foreign_keys = ON;

-- settings table
CREATE TABLE IF NOT EXISTS settings (
  id TEXT PRIMARY KEY NOT NULL,
  key TEXT UNIQUE NOT NULL,
  value TEXT NOT NULL,
  category TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_settings_category ON settings(category);
CREATE INDEX IF NOT EXISTS idx_settings_key ON settings(key);
`

const MIGRATIONS: Record<number, string> = {
  1: MIGRATION_V1,
  2: MIGRATION_V2,
  3: MIGRATION_V3,
}

// ============================================================================
// Types
// ============================================================================

interface DatabaseState {
  isReady: boolean
  isInitializing: boolean
  error: string | null
}

interface DatabaseStore extends DatabaseState {
  // State management
  initializeDatabase: () => Promise<void>
  getDatabase: () => Promise<SQLite.SQLiteDatabase | null>
  resetDatabase: () => Promise<void>
  checkReady: () => boolean

  // Query operations
  queryAll: <T = any>(sql: string, params?: any[]) => Promise<T[]>
  queryFirst: <T = any>(sql: string, params?: any[]) => Promise<T | null>
  queryScalar: <T = any>(sql: string, params?: any[]) => Promise<T | null>
  execute: (sql: string, params?: any[]) => Promise<SQLite.SQLiteRunResult>
  executeTransaction: (callback: (db: SQLite.SQLiteDatabase) => Promise<void>) => Promise<void>

  // Database info
  getDatabaseVersion: () => Promise<number>
  needsMigration: () => Promise<boolean>
  listTables: () => Promise<string[]>
  exportSchema: () => Promise<string>
}

// ============================================================================
// Singleton Instance
// ============================================================================

let dbInstance: SQLite.SQLiteDatabase | null = null

// ============================================================================
// Schema Management
// ============================================================================

/**
 * Ensure the database schema is up to date
 */
async function ensureDatabaseSchema(database: SQLite.SQLiteDatabase): Promise<void> {
  try {
    // Get current version - PRAGMA user_version returns a number directly
    const result = await database.getFirstAsync<{ user_version: number }>('PRAGMA user_version')
    const currentVersion = result?.user_version ?? 0

    console.log(
      '[DatabaseStore] Current schema version:',
      currentVersion,
      'Target version:',
      DATABASE_VERSION
    )

    // Run migrations
    for (let version = currentVersion + 1; version <= DATABASE_VERSION; version++) {
      if (MIGRATIONS[version]) {
        console.log('[DatabaseStore] Running migration', version)
        await database.execAsync(MIGRATIONS[version])
        console.log('[DatabaseStore] Migration', version, 'completed')
      }
    }

    // Update version
    if (currentVersion < DATABASE_VERSION) {
      await database.execAsync(`PRAGMA user_version = ${DATABASE_VERSION}`)
      console.log('[DatabaseStore] Schema version updated to', DATABASE_VERSION)
    }
  } catch (error) {
    console.error('[DatabaseStore] Error ensuring database schema:', error)
    throw error
  }
}

/**
 * Get or create the database instance (singleton pattern)
 */
async function getDatabaseInstance(): Promise<SQLite.SQLiteDatabase> {
  console.log('[DatabaseStore] getDatabaseInstance() called, dbInstance exists:', !!dbInstance)

  if (dbInstance) {
    console.log('[DatabaseStore] Returning existing dbInstance')
    return dbInstance
  }

  console.log('[DatabaseStore] Opening new database:', DATABASE_NAME)
  try {
    const database = await SQLite.openDatabaseAsync(DATABASE_NAME)
    console.log('[DatabaseStore] Database opened, ensuring schema...')

    await ensureDatabaseSchema(database)
    console.log('[DatabaseStore] Schema ensured, setting dbInstance...')

    // Only set dbInstance after schema is ready
    dbInstance = database
    console.log('[DatabaseStore] Database fully initialized, returning database')

    return database
  } catch (error) {
    console.error('[DatabaseStore] Failed to open or initialize database:', error)
    dbInstance = null
    throw new Error(
      'Database initialization failed: ' + (error instanceof Error ? error.message : String(error))
    )
  }
}

/**
 * Get or create the database instance with readiness check
 */
async function getDatabaseWithCheck(): Promise<SQLite.SQLiteDatabase> {
  // If dbInstance exists, return it
  if (dbInstance) {
    console.log('[DatabaseStore] Returning existing dbInstance from getDatabaseWithCheck')
    return dbInstance
  }

  // Otherwise, initialize the database
  console.log('[DatabaseStore] dbInstance is null in getDatabaseWithCheck, initializing...')
  try {
    const database = await SQLite.openDatabaseAsync(DATABASE_NAME)
    dbInstance = database
    await ensureDatabaseSchema(database)
    console.log('[DatabaseStore] Database initialized successfully in getDatabaseWithCheck')
    return database
  } catch (error) {
    console.error('[DatabaseStore] Failed to initialize database in getDatabaseWithCheck:', error)
    throw new Error(
      'Database initialization failed: ' + (error instanceof Error ? error.message : String(error))
    )
  }
}

// ============================================================================
// Store Definition
// ============================================================================

export const useDatabaseStore = create<DatabaseStore>()(
  persist(
    (set, get) => ({
      // Initial state
      isReady: false,
      isInitializing: false,
      error: null,

      // State management methods
      initializeDatabase: async () => {
        console.log('[DatabaseStore] Starting database initialization...')
        set({ isInitializing: true, error: null })
        try {
          console.log('[DatabaseStore] Calling getDatabaseInstance()...')
          const db = await getDatabaseInstance()
          console.log('[DatabaseStore] Database instance obtained:', !!db)

          // Wait a bit to ensure database is fully ready
          await new Promise(resolve => setTimeout(resolve, 100))

          console.log('[DatabaseStore] Database initialization complete')
          set({ isReady: true, isInitializing: false })
        } catch (error) {
          console.error('[DatabaseStore] Failed to initialize database:', error)
          set({
            isReady: false,
            isInitializing: false,
            error: error instanceof Error ? error.message : String(error),
          })
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
          return await getDatabaseInstance()
        } catch (error) {
          console.error('Failed to get database:', error)
          set({ error: error instanceof Error ? error.message : String(error) })
          return null
        }
      },

      resetDatabase: async () => {
        console.log('[DatabaseStore] Starting database reset...')
        set({ isReady: false, isInitializing: true, error: null })

        try {
          // Close existing database if open
          if (dbInstance) {
            console.log('[DatabaseStore] Closing existing database...')
            await dbInstance.closeAsync()
            dbInstance = null
            console.log('[DatabaseStore] Database closed')
          }

          // Wait a bit to ensure database is fully closed
          await new Promise(resolve => setTimeout(resolve, 200))

          // Delete the database file completely
          console.log('[DatabaseStore] Deleting database file...')
          await SQLite.deleteDatabaseAsync(DATABASE_NAME)
          console.log('[DatabaseStore] Database file deleted')

          // Wait a bit before reopening
          await new Promise(resolve => setTimeout(resolve, 100))

          // Open a fresh database
          console.log('[DatabaseStore] Opening fresh database...')
          const database = await SQLite.openDatabaseAsync(DATABASE_NAME)

          if (!database) {
            throw new Error('Failed to open database after reset')
          }

          console.log('[DatabaseStore] Fresh database opened, initializing schema...')

          // Initialize schema from scratch
          await ensureDatabaseSchema(database)

          // Set dbInstance after everything is ready
          dbInstance = database

          console.log('[DatabaseStore] Database reset complete')
          set({ isReady: true, isInitializing: false })
        } catch (error) {
          console.error('[DatabaseStore] Failed to reset database:', error)
          set({
            isReady: false,
            isInitializing: false,
            error: error instanceof Error ? error.message : String(error),
          })
          throw error
        }
      },

      checkReady: () => {
        const { isReady, error } = get()
        return isReady && !error
      },

      // Query operations
      queryAll: async <T = any>(sql: string, params: any[] = []): Promise<T[]> => {
        const database = await getDatabaseWithCheck()
        if (!database) {
          throw new Error('Database not initialized')
        }
        return database.getAllAsync<T>(sql, params)
      },

      queryFirst: async <T = any>(sql: string, params: any[] = []): Promise<T | null> => {
        const database = await getDatabaseWithCheck()
        if (!database) {
          throw new Error('Database not initialized')
        }
        return database.getFirstAsync<T>(sql, params)
      },

      queryScalar: async <T = any>(sql: string, params: any[] = []): Promise<T | null> => {
        const database = await getDatabaseWithCheck()
        if (!database) {
          throw new Error('Database not initialized')
        }
        const result = await database.getFirstAsync<{ value: T }>(sql, params)
        return result ? result.value : null
      },

      execute: async (sql: string, params: any[] = []): Promise<SQLite.SQLiteRunResult> => {
        const database = await getDatabaseWithCheck()
        if (!database) {
          throw new Error('Database not initialized')
        }
        return database.runAsync(sql, params)
      },

      executeTransaction: async (
        callback: (db: SQLite.SQLiteDatabase) => Promise<void>
      ): Promise<void> => {
        const database = await getDatabaseWithCheck()
        await database.execAsync('BEGIN TRANSACTION')

        try {
          await callback(database)
          await database.execAsync('COMMIT')
        } catch (error) {
          await database.execAsync('ROLLBACK')
          throw error
        }
      },

      // Database info methods
      getDatabaseVersion: async (): Promise<number> => {
        const database = await getDatabaseInstance()
        const result = await database.getFirstAsync<{ version: string }>('PRAGMA user_version')
        return result ? parseInt(result.version) : 0
      },

      needsMigration: async (): Promise<boolean> => {
        const currentVersion = await get().getDatabaseVersion()
        return currentVersion < DATABASE_VERSION
      },

      listTables: async (): Promise<string[]> => {
        const database = await getDatabaseInstance()
        const rows = await database.getAllAsync<{ name: string }>(
          "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
        )
        return rows.map(row => row.name)
      },

      exportSchema: async (): Promise<string> => {
        const database = await getDatabaseInstance()
        const rows = await database.getAllAsync<{ sql: string }>(
          "SELECT sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
        )
        return rows.map(row => row.sql).join('\n\n')
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

// ============================================================================
// Utility Functions (for backward compatibility)
// ============================================================================

/**
 * Get database path (useful for debugging)
 */
export function getDatabasePath(): string {
  return DATABASE_NAME
}
