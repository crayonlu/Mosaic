import * as SQLite from 'expo-sqlite'
import { MIGRATION_V1, MIGRATION_V2, MIGRATION_V3 } from './migrations'

// ============================================================================
// Configuration
// ============================================================================

const DATABASE_NAME = 'mosaic.db'
const DATABASE_VERSION = 3 // Match the number of migration files

// ============================================================================
// Migration files
// ============================================================================

const MIGRATIONS: Record<number, string> = {
  1: MIGRATION_V1,
  2: MIGRATION_V2,
  3: MIGRATION_V3,
}

// ============================================================================
// Types
// ============================================================================

export interface DatabaseConnection {
  db: SQLite.SQLiteDatabase
}

// ============================================================================
// Singleton Instance
// ============================================================================

let dbInstance: SQLite.SQLiteDatabase | null = null

/**
 * Get or create the database instance (singleton pattern)
 */
export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (dbInstance) return dbInstance

  const database = await SQLite.openDatabaseAsync(DATABASE_NAME)
  dbInstance = database
  await ensureDatabaseSchema(database)

  return database
}

/**
 * Close the database connection
 */
export async function closeDatabase(): Promise<void> {
  if (dbInstance) {
    await dbInstance.closeAsync()
    dbInstance = null
  }
}

/**
 * Reset the database (for testing/debugging purposes)
 */
export async function resetDatabase(): Promise<void> {
  if (dbInstance) {
    await dbInstance.closeAsync()
    dbInstance = null
  }

  const database = await SQLite.openDatabaseAsync(DATABASE_NAME)
  dbInstance = database

  // Drop all tables
  await database.execAsync(`
    DROP TABLE IF EXISTS resources;
    DROP TABLE IF EXISTS memos;
    DROP TABLE IF EXISTS diaries;
    DROP TABLE IF EXISTS users;
    DROP TABLE IF EXISTS settings;
  `)

  // Reinitialize schema
  await ensureDatabaseSchema(database)
}

// ============================================================================
// Schema Management
// ============================================================================

/**
 * Ensure the database schema is up to date
 */
async function ensureDatabaseSchema(database: SQLite.SQLiteDatabase): Promise<void> {
  // Get current version
  const result = await database.getFirstAsync<{ version: string }>('PRAGMA user_version')
  const currentVersion = result ? parseInt(result.version) : 0

  // Run migrations
  for (let version = currentVersion + 1; version <= DATABASE_VERSION; version++) {
    if (MIGRATIONS[version]) {
      console.log(`Running migration v${version}...`)
      await database.execAsync(MIGRATIONS[version])
    }
  }

  // Update version
  await database.execAsync(`PRAGMA user_version = ${DATABASE_VERSION}`)

  console.log(`Database schema updated to version ${DATABASE_VERSION}`)
}

/**
 * Get the current database version
 */
export async function getDatabaseVersion(): Promise<number> {
  const database = await getDatabase()
  const result = await database.getFirstAsync<{ version: string }>('PRAGMA user_version')
  return result ? parseInt(result.version) : 0
}

/**
 * Check if database needs migration
 */
export async function needsMigration(): Promise<boolean> {
  const currentVersion = await getDatabaseVersion()
  return currentVersion < DATABASE_VERSION
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Execute a raw SQL query and return all results
 */
export async function queryAll<T = any>(sql: string, params: any[] = []): Promise<T[]> {
  const database = await getDatabase()
  return database.getAllAsync<T>(sql, params)
}

/**
 * Execute a raw SQL query and return the first result
 */
export async function queryFirst<T = any>(sql: string, params: any[] = []): Promise<T | null> {
  const database = await getDatabase()
  return database.getFirstAsync<T>(sql, params)
}

/**
 * Execute a raw SQL query and return the first column of the first result
 */
export async function queryScalar<T = any>(sql: string, params: any[] = []): Promise<T | null> {
  const database = await getDatabase()
  const result = await database.getFirstAsync<{ value: T }>(sql, params)
  return result ? result.value : null
}

/**
 * Execute a SQL statement (INSERT, UPDATE, DELETE, etc.)
 */
export async function execute(sql: string, params: any[] = []): Promise<SQLite.SQLiteRunResult> {
  const database = await getDatabase()
  return database.runAsync(sql, params)
}

/**
 * Execute multiple SQL statements in a transaction
 */
export async function executeTransaction(
  callback: (db: SQLite.SQLiteDatabase) => Promise<void>
): Promise<void> {
  const database = await getDatabase()
  await database.execAsync('BEGIN TRANSACTION')

  try {
    await callback(database)
    await database.execAsync('COMMIT')
  } catch (error) {
    await database.execAsync('ROLLBACK')
    throw error
  }
}

// ============================================================================
// Debug Helpers
// ============================================================================

/**
 * Get database file path (useful for debugging)
 * Note: expo-sqlite handles the path automatically on different platforms
 */
export function getDatabasePath(): string {
  return DATABASE_NAME
}

/**
 * List all tables in the database
 */
export async function listTables(): Promise<string[]> {
  const database = await getDatabase()
  const rows = await database.getAllAsync<{ name: string }>(
    "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
  )
  return rows.map(row => row.name)
}

/**
 * Export database schema (useful for debugging)
 */
export async function exportSchema(): Promise<string> {
  const database = await getDatabase()
  const rows = await database.getAllAsync<{ sql: string }>(
    "SELECT sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
  )
  return rows.map(row => row.sql).join('\n\n')
}
