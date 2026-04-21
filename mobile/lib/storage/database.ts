import * as SQLite from 'expo-sqlite'

let db: SQLite.SQLiteDatabase | null = null
let dbInitializing: Promise<SQLite.SQLiteDatabase> | null = null

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (db) return db

  if (dbInitializing) return dbInitializing

  dbInitializing = (async () => {
    try {
      const database = await SQLite.openDatabaseAsync('mosaic.db')

      await database.execAsync(`PRAGMA journal_mode = WAL;`)
      await database.execAsync(`PRAGMA foreign_keys = ON;`)

      await database.execAsync(`
        CREATE TABLE IF NOT EXISTS memos (
          id          TEXT PRIMARY KEY NOT NULL,
          content     TEXT,
          is_archived INTEGER NOT NULL DEFAULT 0,
          diary_date  TEXT,
          created_at  INTEGER NOT NULL,
          updated_at  INTEGER NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_memos_diary_date ON memos(diary_date);
        CREATE INDEX IF NOT EXISTS idx_memos_created ON memos(created_at);
        CREATE INDEX IF NOT EXISTS idx_memos_archived ON memos(is_archived);

        CREATE TABLE IF NOT EXISTS memo_tags (
          memo_id TEXT NOT NULL,
          tag     TEXT NOT NULL,
          PRIMARY KEY (memo_id, tag),
          FOREIGN KEY (memo_id) REFERENCES memos(id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_memo_tags_tag ON memo_tags(tag);

        CREATE TABLE IF NOT EXISTS resources (
          id            TEXT PRIMARY KEY NOT NULL,
          memo_id       TEXT,
          filename      TEXT NOT NULL,
          resource_type TEXT NOT NULL,
          mime_type     TEXT NOT NULL,
          file_size     INTEGER NOT NULL DEFAULT 0,
          storage_type  TEXT NOT NULL DEFAULT 'local',
          url           TEXT NOT NULL,
          thumbnail_url TEXT,
          metadata      TEXT,
          created_at    INTEGER NOT NULL,
          FOREIGN KEY (memo_id) REFERENCES memos(id) ON DELETE SET NULL
        );

        CREATE INDEX IF NOT EXISTS idx_resources_memo ON resources(memo_id);
        CREATE INDEX IF NOT EXISTS idx_resources_type ON resources(resource_type);

        CREATE TABLE IF NOT EXISTS diaries (
          date           TEXT PRIMARY KEY NOT NULL,
          summary        TEXT,
          mood_key       TEXT,
          mood_score     REAL,
          cover_image_id TEXT,
          created_at     INTEGER NOT NULL,
          updated_at     INTEGER NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_diaries_mood ON diaries(mood_key);

        CREATE TABLE IF NOT EXISTS stats_daily (
          date        TEXT PRIMARY KEY NOT NULL,
          memo_count  INTEGER NOT NULL DEFAULT 0,
          diary_count INTEGER NOT NULL DEFAULT 0,
          mood_score  REAL
        );
      `)

      db = database
      return database
    } finally {
      dbInitializing = null
    }
  })()

  return dbInitializing
}

export async function closeDatabase(): Promise<void> {
  if (db) {
    await db.closeAsync()
    db = null
  }
}
