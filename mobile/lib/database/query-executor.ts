import * as SQLite from 'expo-sqlite'
import { connectionManager } from './connection-manager'
import { QueryError, TimeoutError } from './errors'
import { logger } from './logger'

// ============================================================================
// Configuration
// ============================================================================

const DEFAULT_RETRIES = 3
const DEFAULT_RETRY_DELAY = 500 // milliseconds
const DEFAULT_TIMEOUT = 10000 // 10 seconds
const MAX_CONCURRENT_REQUESTS = 10

// ============================================================================
// Types
// ============================================================================

export interface QueryOptions {
  retries?: number
  retryDelay?: number
  timeout?: number
  onRetry?: (error: Error, attempt: number) => void
}

export interface Query {
  sql: string
  params?: unknown[]
}

// ============================================================================
// Semaphore for concurrency control
// ============================================================================

class Semaphore {
  private permits: number
  private queue: (() => void)[] = []

  constructor(permits: number) {
    this.permits = permits
  }

  async acquire(): Promise<void> {
    if (this.permits > 0) {
      this.permits--
      return
    }

    return new Promise<void>(resolve => {
      this.queue.push(resolve)
    })
  }

  release(): void {
    if (this.queue.length > 0) {
      const resolve = this.queue.shift()
      if (resolve) {
        resolve()
      }
    } else {
      this.permits++
    }
  }
}

// ============================================================================
// Query Executor
// ============================================================================

/**
 * Executes database queries with retry logic and concurrency control
 */
class QueryExecutor {
  private static instance: QueryExecutor
  private semaphore: Semaphore

  private constructor() {
    this.semaphore = new Semaphore(MAX_CONCURRENT_REQUESTS)
  }

  /**
   * Get singleton instance
   */
  static getInstance(): QueryExecutor {
    if (!QueryExecutor.instance) {
      QueryExecutor.instance = new QueryExecutor()
    }
    return QueryExecutor.instance
  }

  /**
   * Execute query with retry logic
   */
  private async executeWithRetry<T>(
    operation: () => Promise<T>,
    options: QueryOptions = {}
  ): Promise<T> {
    const {
      retries = DEFAULT_RETRIES,
      retryDelay = DEFAULT_RETRY_DELAY,
      timeout = DEFAULT_TIMEOUT,
      onRetry,
    } = options

    let lastError: Error | null = null

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        // Execute with timeout
        const result = (await Promise.race([
          operation(),
          new Promise<never>((_, reject) => {
            setTimeout(() => {
              reject(new TimeoutError(`Query timeout after ${timeout}ms`, timeout))
            }, timeout)
          }),
        ])) as T

        return result
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error))

        // Check if should retry
        const shouldRetry =
          attempt < retries && !(error instanceof TimeoutError) && !(error instanceof QueryError)

        if (shouldRetry) {
          logger.warn('QueryExecutor', `Query failed, retrying (${attempt}/${retries})`, {
            error: lastError,
            sql: this.extractSql(operation),
          })

          // Call retry callback
          if (onRetry) {
            onRetry(lastError, attempt)
          }

          // Wait before retry
          await new Promise(resolve => setTimeout(resolve, retryDelay * attempt))
        } else {
          // No more retries, throw as error
          logger.error('QueryExecutor', 'Query failed after all retries', {
            error: lastError,
            sql: this.extractSql(operation),
            attempts: attempt,
          })
          throw lastError
        }
      }
    }

    // This should never be reached
    throw new Error('Unexpected error in executeWithRetry')
  }

  /**
   * Extract SQL from operation for logging
   */
  private extractSql(operation: () => Promise<unknown>): string {
    const operationStr = operation.toString()
    const match = operationStr.match(/SELECT|INSERT|UPDATE|DELETE|CREATE|ALTER/i)
    return match ? match[0] : 'UNKNOWN'
  }

  /**
   * Execute query and return all results
   */
  async query<T>(sql: string, params?: unknown[], options?: QueryOptions): Promise<T[]> {
    logger.info('QueryExecutor', 'Executing query', { sql, params })

    const bindParams = (params || []) as import('expo-sqlite').SQLiteBindValue[]

    return this.executeWithRetry<T[]>(async () => {
      await this.semaphore.acquire()

      try {
        const database = await connectionManager.getConnection()
        const results = await database.getAllAsync<T>(sql, bindParams)
        logger.info('QueryExecutor', 'Query executed successfully', {
          sql,
          resultCount: results.length,
        })
        return results
      } finally {
        this.semaphore.release()
      }
    }, options)
  }

  /**
   * Execute query and return first result
   */
  async queryFirst<T>(sql: string, params?: unknown[], options?: QueryOptions): Promise<T | null> {
    logger.info('QueryExecutor', 'Executing queryFirst', { sql, params })

    const bindParams = (params || []) as import('expo-sqlite').SQLiteBindValue[]

    return this.executeWithRetry<T | null>(async () => {
      await this.semaphore.acquire()

      try {
        const database = await connectionManager.getConnection()
        const result = await database.getFirstAsync<T>(sql, bindParams)
        logger.info('QueryExecutor', 'queryFirst executed successfully', {
          sql,
          hasResult: !!result,
        })
        return result
      } finally {
        this.semaphore.release()
      }
    }, options)
  }

  /**
   * Execute query and return scalar value
   */
  async queryScalar<T>(sql: string, params?: unknown[], options?: QueryOptions): Promise<T | null> {
    logger.info('QueryExecutor', 'Executing queryScalar', { sql, params })

    const bindParams = (params || []) as import('expo-sqlite').SQLiteBindValue[]

    return this.executeWithRetry<T | null>(async () => {
      await this.semaphore.acquire()

      try {
        const database = await connectionManager.getConnection()
        const result = await database.getFirstAsync<{ value: T }>(sql, bindParams)
        logger.info('QueryExecutor', 'queryScalar executed successfully', {
          sql,
          hasResult: !!result,
        })
        return result ? result.value : null
      } finally {
        this.semaphore.release()
      }
    }, options)
  }

  /**
   * Execute SQL statement (INSERT, UPDATE, DELETE)
   */
  async execute(
    sql: string,
    params?: unknown[],
    options?: QueryOptions
  ): Promise<SQLite.SQLiteRunResult> {
    logger.info('QueryExecutor', 'Executing execute', { sql, params })

    const bindParams = (params || []) as import('expo-sqlite').SQLiteBindValue[]

    return this.executeWithRetry<SQLite.SQLiteRunResult>(async () => {
      await this.semaphore.acquire()

      try {
        const database = await connectionManager.getConnection()
        const result = await database.runAsync(sql, bindParams)
        logger.info('QueryExecutor', 'Execute executed successfully', {
          sql,
          changes: result.changes,
          lastInsertRowId: result.lastInsertRowId,
        })
        return result
      } finally {
        this.semaphore.release()
      }
    }, options)
  }

  /**
   * Execute multiple queries in a transaction
   */
  async transaction<T>(callback: (db: SQLite.SQLiteDatabase) => Promise<T>): Promise<T> {
    logger.info('QueryExecutor', 'Starting transaction')

    await this.semaphore.acquire()

    try {
      const database = await connectionManager.getConnection()

      await database.execAsync('BEGIN TRANSACTION')

      try {
        const result = await callback(database)
        logger.info('QueryExecutor', 'Transaction completed successfully')
        return result
      } catch (error) {
        await database.execAsync('ROLLBACK')
        logger.error('QueryExecutor', 'Transaction failed and rolled back', { error })
        throw error
      } finally {
        this.semaphore.release()
      }
    } catch (error) {
      this.semaphore.release()
      logger.error('QueryExecutor', 'Failed to start transaction', { error })
      throw error
    }
  }

  /**
   * Execute multiple queries in batch
   */
  async batch(queries: Query[]): Promise<SQLite.SQLiteRunResult[]> {
    logger.info('QueryExecutor', 'Executing batch', { queryCount: queries.length })

    return this.executeWithRetry<SQLite.SQLiteRunResult[]>(
      async () => {
        await this.semaphore.acquire()

        try {
          const database = await connectionManager.getConnection()

          await database.execAsync('BEGIN TRANSACTION')

          try {
            const results: SQLite.SQLiteRunResult[] = []

            for (const query of queries) {
              const result = await database.runAsync(
                query.sql,
                (query.params || []) as import('expo-sqlite').SQLiteBindValue[]
              )
              results.push(result)
            }

            await database.execAsync('COMMIT')

            logger.info('QueryExecutor', 'Batch executed successfully', {
              queryCount: queries.length,
              totalChanges: results.reduce((sum, r) => sum + (r.changes || 0), 0),
            })

            return results
          } catch (error) {
            await database.execAsync('ROLLBACK')
            logger.error('QueryExecutor', 'Batch failed and rolled back', { error })
            throw error
          }
        } finally {
          this.semaphore.release()
        }
      },
      { retries: 1 } // Batch operations should only retry once
    )
  }
}

// Export singleton instance
export const queryExecutor = QueryExecutor.getInstance()
