import dayjs from 'dayjs'

/**
 * Database Logger
 * Provides structured logging for database operations
 */
class DatabaseLogger {
  private static instance: DatabaseLogger

  private constructor() {
    // Private constructor for singleton
  }

  /**
   * Get singleton instance
   */
  static getInstance(): DatabaseLogger {
    if (!DatabaseLogger.instance) {
      DatabaseLogger.instance = new DatabaseLogger()
    }
    return DatabaseLogger.instance
  }

  /**
   * Log a message with level, category, and optional data
   */
  log(level: 'info' | 'warn' | 'error', category: string, message: string, data?: unknown): void {
    const timestamp = dayjs().toISOString()
    const logEntry = {
      timestamp,
      level,
      category,
      message,
      data,
    }

    console.log(`[Database][${level.toUpperCase()}][${category}]`, message, data || '')

    // Can be extended to write to file or send to logging service
  }

  /**
   * Log info message
   */
  info(category: string, message: string, data?: unknown): void {
    this.log('info', category, message, data)
  }

  /**
   * Log warning message
   */
  warn(category: string, message: string, data?: unknown): void {
    this.log('warn', category, message, data)
  }

  /**
   * Log error message
   */
  error(category: string, message: string, data?: unknown): void {
    this.log('error', category, message, data)
  }
}

// Export singleton instance
export const logger = DatabaseLogger.getInstance()
