import { DATABASE_NAME, DATABASE_VERSION, MIGRATIONS } from '@/migrations'
import * as SQLite from 'expo-sqlite'
import { ConnectionError } from './errors'
import { logger } from './logger'

// ============================================================================
// Configuration
// ============================================================================

const HEALTH_CHECK_INTERVAL = 30000 // 30 seconds

// ============================================================================
// Types
// ============================================================================

export type DatabaseStateType = 'uninitialized' | 'initializing' | 'ready' | 'resetting' | 'error'

export interface DatabaseState {
  state: DatabaseStateType
  isReady: boolean
  isInitializing: boolean
  error: string | null
  lastErrorTime: number | null
}

// ============================================================================
// Connection Manager
// ============================================================================

/**
 * Manages database connection lifecycle with health checks and auto-reconnect
 */
class ConnectionManager {
  private static instance: ConnectionManager
  private connection: SQLite.SQLiteDatabase | null = null
  private healthCheckInterval: NodeJS.Timeout | null = null
  private isHealthy: boolean = true
  private isResetting: boolean = false

  private constructor() {
    // Private constructor for singleton
  }

  /**
   * Get singleton instance
   */
  static getInstance(): ConnectionManager {
    if (!ConnectionManager.instance) {
      ConnectionManager.instance = new ConnectionManager()
    }
    return ConnectionManager.instance
  }

  /**
   * Get database connection with health check
   */
  async getConnection(): Promise<SQLite.SQLiteDatabase> {
    // Check if resetting
    if (this.isResetting) {
      throw new ConnectionError('Database is being reset, please try again later')
    }

    // Return existing connection if healthy
    if (this.connection && this.isHealthy) {
      logger.info('ConnectionManager', 'Returning existing healthy connection')
      return this.connection
    }

    // Try to get or create connection
    try {
      if (this.connection) {
        logger.warn('ConnectionManager', 'Connection exists but unhealthy, attempting to reconnect')
        await this.reconnect()
      } else {
        logger.info('ConnectionManager', 'Creating new database connection')
        this.connection = await SQLite.openDatabaseAsync(DATABASE_NAME)
        await this.ensureSchema(this.connection)
        this.startHealthCheck()
      }

      this.isHealthy = true
      return this.connection
    } catch (error) {
      this.isHealthy = false
      this.connection = null
      logger.error('ConnectionManager', 'Failed to get database connection', { error })
      throw new ConnectionError(
        'Failed to get database connection',
        error instanceof Error ? error : undefined
      )
    }
  }

  /**
   * Ensure database schema is up to date
   */
  private async ensureSchema(database: SQLite.SQLiteDatabase): Promise<void> {
    try {
      const result = await database.getFirstAsync<{ user_version: number }>('PRAGMA user_version')
      const currentVersion = result?.user_version ?? 0

      logger.info(
        'ConnectionManager',
        `Current schema version: ${currentVersion}, Target: ${DATABASE_VERSION}`
      )

      // Run migrations
      for (let version = currentVersion + 1; version <= DATABASE_VERSION; version++) {
        if (MIGRATIONS[version]) {
          logger.info('ConnectionManager', `Running migration ${version}`)
          await database.execAsync(MIGRATIONS[version])
          logger.info('ConnectionManager', `Migration ${version} completed`)
        }
      }

      // Update version
      if (currentVersion < DATABASE_VERSION) {
        await database.execAsync(`PRAGMA user_version = ${DATABASE_VERSION}`)
        logger.info('ConnectionManager', `Schema version updated to ${DATABASE_VERSION}`)
      }
    } catch (error) {
      logger.error('ConnectionManager', 'Failed to ensure database schema', { error })
      throw error
    }
  }

  /**
   * Perform health check on database connection
   */
  async healthCheck(): Promise<boolean> {
    if (!this.connection) {
      return false
    }

    try {
      // Execute a simple query to test connection
      await this.connection.getFirstAsync('SELECT 1 as test')
      this.isHealthy = true
      return true
    } catch (error) {
      this.isHealthy = false
      logger.warn('ConnectionManager', 'Health check failed', { error })
      return false
    }
  }

  /**
   * Reconnect to database
   */
  private async reconnect(): Promise<void> {
    logger.info('ConnectionManager', 'Attempting to reconnect to database')

    try {
      if (this.connection) {
        await this.connection.closeAsync()
      }
    } catch (error) {
      logger.warn('ConnectionManager', 'Failed to close connection during reconnect', { error })
    }

    this.connection = null
    await this.getConnection()
  }

  /**
   * Start periodic health checks
   */
  private startHealthCheck(): void {
    this.stopHealthCheck()

    this.healthCheckInterval = setInterval(async () => {
      await this.healthCheck()
    }, HEALTH_CHECK_INTERVAL) as unknown as NodeJS.Timeout

    logger.info('ConnectionManager', `Started health check interval (${HEALTH_CHECK_INTERVAL}ms)`)
  }

  /**
   * Stop periodic health checks
   */
  private stopHealthCheck(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval)
      this.healthCheckInterval = null
      logger.info('ConnectionManager', 'Stopped health check interval')
    }
  }

  /**
   * Close database connection
   */
  async close(): Promise<void> {
    logger.info('ConnectionManager', 'Closing database connection')

    this.stopHealthCheck()

    if (this.connection) {
      try {
        await this.connection.closeAsync()
        logger.info('ConnectionManager', 'Database connection closed')
      } catch (error) {
        logger.error('ConnectionManager', 'Failed to close database connection', { error })
      } finally {
        this.connection = null
        this.isHealthy = false
      }
    }
  }

  /**
   * Reset database (delete and recreate)
   */
  async reset(): Promise<void> {
    if (this.isResetting) {
      throw new ConnectionError('Database is already being reset')
    }

    this.isResetting = true
    logger.info('ConnectionManager', 'Starting database reset')

    try {
      // Close existing connection
      if (this.connection) {
        await this.connection.closeAsync()
        this.connection = null
        logger.info('ConnectionManager', 'Database connection closed')
      }

      // Wait to ensure database is fully closed
      await new Promise(resolve => setTimeout(resolve, 200))

      // Delete database file completely
      logger.info('ConnectionManager', 'Deleting database file')
      await SQLite.deleteDatabaseAsync(DATABASE_NAME)
      logger.info('ConnectionManager', 'Database file deleted')

      // Wait a bit before reopening
      await new Promise(resolve => setTimeout(resolve, 100))

      // Open a fresh database
      logger.info('ConnectionManager', 'Opening fresh database')
      this.connection = await SQLite.openDatabaseAsync(DATABASE_NAME)

      if (!this.connection) {
        throw new ConnectionError('Failed to open database after reset')
      }

      // Initialize schema from scratch
      await this.ensureSchema(this.connection)

      // Start health check
      this.startHealthCheck()

      logger.info('ConnectionManager', 'Database reset complete')
    } catch (error) {
      this.isHealthy = false
      this.connection = null
      logger.error('ConnectionManager', 'Failed to reset database', { error })
      throw new ConnectionError(
        'Failed to reset database',
        error instanceof Error ? error : undefined
      )
    } finally {
      this.isResetting = false
    }
  }

  /**
   * Get database version
   */
  async getDatabaseVersion(): Promise<number> {
    const database = await this.getConnection()
    const result = await database.getFirstAsync<{ version: string }>('PRAGMA user_version')
    return result ? parseInt(result.version) : 0
  }

  /**
   * Check if database needs migration
   */
  async needsMigration(): Promise<boolean> {
    const currentVersion = await this.getDatabaseVersion()
    return currentVersion < DATABASE_VERSION
  }

  /**
   * List all tables in database
   */
  async listTables(): Promise<string[]> {
    const database = await this.getConnection()
    const result = await database.getAllAsync<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
    )
    return result.map(row => row.name)
  }

  /**
   * Export database schema
   */
  async exportSchema(): Promise<string> {
    const database = await this.getConnection()
    const tables = await this.listTables()

    const schema: string[] = []
    for (const table of tables) {
      const result = await database.getFirstAsync<{ sql: string }>(
        `SELECT sql FROM sqlite_master WHERE type='table' AND name=?`,
        [table]
      )
      if (result?.sql) {
        schema.push(result.sql + ';\n')
      }
    }

    return schema.join('\n')
  }
}

// Export singleton instance
export const connectionManager = ConnectionManager.getInstance()
