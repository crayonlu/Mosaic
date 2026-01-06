/**
 * Database Error Base Class
 */
export class DatabaseError extends Error {
  constructor(
    message: string,
    public code: string,
    public originalError?: Error
  ) {
    super(message)
    this.name = 'DatabaseError'
  }
}

/**
 * Connection Error - Database connection failed
 */
export class ConnectionError extends DatabaseError {
  constructor(message: string, originalError?: Error) {
    super(message, 'CONNECTION_ERROR', originalError)
    this.name = 'ConnectionError'
  }
}

/**
 * Query Error - Database query execution failed
 */
export class QueryError extends DatabaseError {
  constructor(
    message: string,
    public sql: string,
    public params?: unknown[],
    originalError?: Error
  ) {
    super(message, 'QUERY_ERROR', originalError)
    this.name = 'QueryError'
  }
}

/**
 * Transaction Error - Database transaction failed
 */
export class TransactionError extends DatabaseError {
  constructor(message: string, originalError?: Error) {
    super(message, 'TRANSACTION_ERROR', originalError)
    this.name = 'TransactionError'
  }
}

/**
 * Migration Error - Database migration failed
 */
export class MigrationError extends DatabaseError {
  constructor(
    message: string,
    public version: number,
    originalError?: Error
  ) {
    super(message, 'MIGRATION_ERROR', originalError)
    this.name = 'MigrationError'
  }
}

/**
 * Timeout Error - Database operation timed out
 */
export class TimeoutError extends DatabaseError {
  constructor(
    message: string,
    public timeout: number,
    originalError?: Error
  ) {
    super(message, 'TIMEOUT_ERROR', originalError)
    this.name = 'TimeoutError'
  }
}
