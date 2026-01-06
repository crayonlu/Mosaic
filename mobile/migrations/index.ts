import { MIGRATION_V1 } from './v1'
import { MIGRATION_V2 } from './v2'
import { MIGRATION_V3 } from './v3'

// ============================================================================
// Configuration
// ============================================================================
const DATABASE_NAME = 'mosaic.db'
const DATABASE_VERSION = 3 // Match the number of migration files

// ============================================================================
// Migration SQL Statements
// ============================================================================
const MIGRATIONS: Record<number, string> = {
  1: MIGRATION_V1,
  2: MIGRATION_V2,
  3: MIGRATION_V3,
}

export { MIGRATIONS, DATABASE_NAME, DATABASE_VERSION }
