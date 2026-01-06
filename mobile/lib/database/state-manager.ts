import AsyncStorage from '@react-native-async-storage/async-storage'
import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { DatabaseError } from './errors'
import { logger } from './logger'
import type { DatabaseStateType } from './types'

// ============================================================================
// Types
// ============================================================================

export interface DatabaseState {
  state: DatabaseStateType
  isReady: boolean
  isInitializing: boolean
  error: string | null
  lastErrorTime: number | null
  retryCount: number
}

export interface DatabaseStore extends DatabaseState {
  // Lifecycle methods
  initialize: () => Promise<void>
  reset: () => Promise<void>
  close: () => Promise<void>

  // Aliases for backward compatibility
  initializeDatabase: () => Promise<void>
  resetDatabase: () => Promise<void>

  // Query methods
  queryAll: <T>(
    sql: string,
    params?: unknown[],
    options?: import('./query-executor').QueryOptions
  ) => Promise<T[]>
  queryFirst: <T>(
    sql: string,
    params?: unknown[],
    options?: import('./query-executor').QueryOptions
  ) => Promise<T | null>
  queryScalar: <T>(
    sql: string,
    params?: unknown[],
    options?: import('./query-executor').QueryOptions
  ) => Promise<T | null>
  execute: (
    sql: string,
    params?: unknown[],
    options?: import('./query-executor').QueryOptions
  ) => Promise<import('expo-sqlite').SQLiteRunResult>
  transaction: <T>(callback: (db: import('expo-sqlite').SQLiteDatabase) => Promise<T>) => Promise<T>
  executeTransaction: <T>(
    callback: (db: import('expo-sqlite').SQLiteDatabase) => Promise<T>
  ) => Promise<T>

  // Utility methods
  getDatabaseVersion: () => Promise<number>
  needsMigration: () => Promise<boolean>
  listTables: () => Promise<string[]>
  exportSchema: () => Promise<string>
}

// ============================================================================
// State Manager
// ============================================================================

/**
 * Manages database state with state machine and event notifications
 */
class StateManager {
  private static instance: StateManager
  private state: DatabaseState = {
    state: 'uninitialized',
    isReady: false,
    isInitializing: false,
    error: null,
    lastErrorTime: null,
    retryCount: 0,
  }
  private listeners: Set<() => void> = new Set()

  private constructor() {
    // Private constructor for singleton
  }

  /**
   * Get singleton instance
   */
  static getInstance(): StateManager {
    if (!StateManager.instance) {
      StateManager.instance = new StateManager()
    }
    return StateManager.instance
  }

  /**
   * Get current state
   */
  getState(): DatabaseState {
    return { ...this.state }
  }

  /**
   * Update state
   */
  setState(newState: Partial<DatabaseState>): void {
    const oldState = this.state
    this.state = { ...this.state, ...newState }

    logger.info('StateManager', 'State updated', {
      oldState,
      newState: this.state,
    })

    // Notify listeners
    this.listeners.forEach(listener => listener())
  }

  /**
   * Transition to new state
   */
  transitionTo(newState: DatabaseStateType): void {
    const validTransitions: Record<DatabaseStateType, DatabaseStateType[]> = {
      uninitialized: ['initializing'],
      initializing: ['ready', 'error'],
      ready: ['resetting', 'error'],
      resetting: ['ready', 'error'],
      error: ['initializing', 'ready'],
    }

    const allowedStates = validTransitions[this.state.state] || []

    if (!allowedStates.includes(newState)) {
      throw new DatabaseError(
        `Invalid state transition from ${this.state.state} to ${newState}`,
        'INVALID_STATE_TRANSITION'
      )
    }

    logger.info('StateManager', `State transition: ${this.state.state} -> ${newState}`)

    this.setState({
      state: newState,
      isInitializing: newState === 'initializing' || newState === 'resetting',
      isReady: newState === 'ready',
      error: newState === 'error' ? this.state.error : null,
    })
  }

  /**
   * Subscribe to state changes
   */
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)

    // Return unsubscribe function
    return () => {
      this.listeners.delete(listener)
    }
  }

  /**
   * Check if ready
   */
  isReady(): boolean {
    return this.state.state === 'ready' && this.state.isReady
  }

  /**
   * Check if initializing
   */
  isInitializing(): boolean {
    return this.state.state === 'initializing' || this.state.state === 'resetting'
  }

  /**
   * Check if has error
   */
  hasError(): boolean {
    return this.state.state === 'error' && !!this.state.error
  }
}

// ============================================================================
// Zustand Store
// ============================================================================

export const useDatabaseStore = create<DatabaseStore>()(
  persist(
    (set, get) => ({
      // Initial state
      state: 'uninitialized',
      isReady: false,
      isInitializing: false,
      error: null,
      lastErrorTime: null,
      retryCount: 0,

      // Lifecycle methods
      initialize: async () => {
        const stateManager = StateManager.getInstance()

        logger.info('useDatabaseStore', 'Starting database initialization')
        stateManager.transitionTo('initializing')

        try {
          const { connectionManager } = await import('./connection-manager')

          await connectionManager.getConnection()
          logger.info('useDatabaseStore', 'Database initialized successfully')

          stateManager.transitionTo('ready')
          set({
            state: 'ready',
            isReady: true,
            isInitializing: false,
            error: null,
            retryCount: 0,
          })
        } catch (error) {
          logger.error('useDatabaseStore', 'Failed to initialize database', { error })

          stateManager.transitionTo('error')
          set({
            state: 'error',
            isReady: false,
            isInitializing: false,
            error: error instanceof Error ? error.message : String(error),
            lastErrorTime: Date.now(),
            retryCount: get().retryCount + 1,
          })
          throw error
        }
      },

      // Alias for backward compatibility
      initializeDatabase: async () => {
        return get().initialize()
      },

      reset: async () => {
        const stateManager = StateManager.getInstance()

        logger.info('useDatabaseStore', 'Starting database reset')
        stateManager.transitionTo('resetting')

        try {
          const { connectionManager } = await import('./connection-manager')

          await connectionManager.reset()
          logger.info('useDatabaseStore', 'Database reset successfully')

          stateManager.transitionTo('ready')
          set({
            state: 'ready',
            isReady: true,
            isInitializing: false,
            error: null,
            retryCount: 0,
          })
        } catch (error) {
          logger.error('useDatabaseStore', 'Failed to reset database', { error })

          stateManager.transitionTo('error')
          set({
            state: 'error',
            isReady: false,
            isInitializing: false,
            error: error instanceof Error ? error.message : String(error),
            lastErrorTime: Date.now(),
            retryCount: get().retryCount + 1,
          })
          throw error
        }
      },

      // Alias for backward compatibility
      resetDatabase: async () => {
        return get().reset()
      },

      close: async () => {
        const stateManager = StateManager.getInstance()

        logger.info('useDatabaseStore', 'Closing database')
        stateManager.transitionTo('uninitialized')

        try {
          const { connectionManager } = await import('./connection-manager')

          await connectionManager.close()
          logger.info('useDatabaseStore', 'Database closed successfully')

          set({
            state: 'uninitialized',
            isReady: false,
            isInitializing: false,
            error: null,
          })
        } catch (error) {
          logger.error('useDatabaseStore', 'Failed to close database', { error })

          stateManager.transitionTo('error')
          set({
            state: 'error',
            isReady: false,
            isInitializing: false,
            error: error instanceof Error ? error.message : String(error),
            lastErrorTime: Date.now(),
          })
          throw error
        }
      },

      // Query methods (delegate to QueryExecutor)
      queryAll: async <T>(
        sql: string,
        params?: unknown[],
        options?: import('./query-executor').QueryOptions
      ) => {
        const { queryExecutor } = await import('./query-executor')
        return queryExecutor.query<T>(sql, params, options)
      },

      queryFirst: async <T>(
        sql: string,
        params?: unknown[],
        options?: import('./query-executor').QueryOptions
      ) => {
        const { queryExecutor } = await import('./query-executor')
        return queryExecutor.queryFirst<T>(sql, params, options)
      },

      queryScalar: async <T>(
        sql: string,
        params?: unknown[],
        options?: import('./query-executor').QueryOptions
      ) => {
        const { queryExecutor } = await import('./query-executor')
        return queryExecutor.queryScalar<T>(sql, params, options)
      },

      execute: async (
        sql: string,
        params?: unknown[],
        options?: import('./query-executor').QueryOptions
      ) => {
        const { queryExecutor } = await import('./query-executor')
        return queryExecutor.execute(sql, params, options)
      },

      transaction: async <T>(
        callback: (db: import('expo-sqlite').SQLiteDatabase) => Promise<T>
      ) => {
        const { queryExecutor } = await import('./query-executor')
        return queryExecutor.transaction(callback)
      },

      // Alias for backward compatibility
      executeTransaction: async <T>(
        callback: (db: import('expo-sqlite').SQLiteDatabase) => Promise<T>
      ) => {
        return get().transaction(callback)
      },

      // Utility methods (delegate to ConnectionManager)
      getDatabaseVersion: async () => {
        const { connectionManager } = await import('./connection-manager')
        return connectionManager.getDatabaseVersion()
      },

      needsMigration: async () => {
        const { connectionManager } = await import('./connection-manager')
        return connectionManager.needsMigration()
      },

      listTables: async () => {
        const { connectionManager } = await import('./connection-manager')
        return connectionManager.listTables()
      },

      exportSchema: async () => {
        const { connectionManager } = await import('./connection-manager')
        return connectionManager.exportSchema()
      },
    }),
    {
      name: 'mosaic-database-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
)
