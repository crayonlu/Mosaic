import { logger } from './logger'
import { connectionManager } from './connection-manager'
import { queryExecutor } from './query-executor'
import { DatabaseError } from './errors'

// ============================================================================
// Database Manager
// ============================================================================

/**
 * Database Manager
 * Coordinates ConnectionManager, QueryExecutor, and StateManager
 * Provides unified database access interface
 */
class DatabaseManager {
  private static instance: DatabaseManager

  private constructor() {
    // Private constructor for singleton
  }

  /**
   * Get singleton instance
   */
  static getInstance(): DatabaseManager {
    if (!DatabaseManager.instance) {
      DatabaseManager.instance = new DatabaseManager()
    }
    return DatabaseManager.instance
  }

  /**
   * Initialize database
   */
  async initialize(): Promise<void> {
    logger.info('DatabaseManager', 'Initializing database')

    try {
      await connectionManager.getConnection()
      logger.info('DatabaseManager', 'Database initialized successfully')
    } catch (error) {
      logger.error('DatabaseManager', 'Failed to initialize database', { error })
      throw new DatabaseError(
        'Failed to initialize database',
        error instanceof Error ? error.message : String(error)
      )
    }
  }

  /**
   * Reset database
   */
  async reset(): Promise<void> {
    logger.info('DatabaseManager', 'Starting database reset')

    try {
      await connectionManager.reset()
      logger.info('DatabaseManager', 'Database reset successfully')
    } catch (error) {
      logger.error('DatabaseManager', 'Failed to reset database', { error })
      throw new DatabaseError(
        'Failed to reset database',
        error instanceof Error ? error.message : String(error)
      )
    }
  }

  /**
   * Close database
   */
  async close(): Promise<void> {
    logger.info('DatabaseManager', 'Closing database')

    try {
      await connectionManager.close()
      logger.info('DatabaseManager', 'Database closed successfully')
    } catch (error) {
      logger.error('DatabaseManager', 'Failed to close database', { error })
      throw new DatabaseError(
        'Failed to close database',
        error instanceof Error ? error.message : String(error)
      )
    }
  }

  /**
   * Query database and return all results
   */
  async query<T>(
    sql: string,
    params?: unknown[],
    options?: import('./query-executor').QueryOptions
  ): Promise<T[]> {
    return queryExecutor.query<T>(sql, params, options)
  }

  /**
   * Query database and return first result
   */
  async queryFirst<T>(
    sql: string,
    params?: unknown[],
    options?: import('./query-executor').QueryOptions
  ): Promise<T | null> {
    return queryExecutor.queryFirst<T>(sql, params, options)
  }

  /**
   * Query database and return scalar value
   */
  async queryScalar<T>(
    sql: string,
    params?: unknown[],
    options?: import('./query-executor').QueryOptions
  ): Promise<T | null> {
    return queryExecutor.queryScalar<T>(sql, params, options)
  }

  /**
   * Execute SQL statement (INSERT, UPDATE, DELETE)
   */
  async execute(
    sql: string,
    params?: unknown[],
    options?: import('./query-executor').QueryOptions
  ): Promise<import('expo-sqlite').SQLiteRunResult> {
    return queryExecutor.execute(sql, params, options)
  }

  /**
   * Execute multiple queries in a transaction
   */
  async transaction<T>(
    callback: (db: import('expo-sqlite').SQLiteDatabase) => Promise<T>
  ): Promise<T> {
    return queryExecutor.transaction(callback)
  }

  /**
   * Execute multiple queries in batch
   */
  async batch(
    queries: import('./query-executor').Query[]
  ): Promise<import('expo-sqlite').SQLiteRunResult[]> {
    return queryExecutor.batch(queries)
  }

  /**
   * Get database version
   */
  async getDatabaseVersion(): Promise<number> {
    const { connectionManager } = await import('./connection-manager')
    return connectionManager.getDatabaseVersion()
  }

  /**
   * Check if database needs migration
   */
  async needsMigration(): Promise<boolean> {
    const { connectionManager } = await import('./connection-manager')
    return connectionManager.needsMigration()
  }

  /**
   * List all tables in database
   */
  async listTables(): Promise<string[]> {
    const { connectionManager } = await import('./connection-manager')
    return connectionManager.listTables()
  }

  /**
   * Export database schema
   */
  async exportSchema(): Promise<string> {
    const { connectionManager } = await import('./connection-manager')
    return connectionManager.exportSchema()
  }
}

// Export singleton instance
export const databaseManager = DatabaseManager.getInstance()
