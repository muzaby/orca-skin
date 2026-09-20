import Database from 'better-sqlite3'

export interface FileDatabaseOptions extends Database.Options {
  readonly initialize?: (db: Database.Database) => void
}

/** The caller owns schema initialization and closes the returned connection. */
export function openFileDatabase(
  path: string,
  { initialize, ...options }: FileDatabaseOptions = {}
): Database.Database {
  const db = new Database(path, options)
  try {
    db.pragma('journal_mode = WAL')
    db.pragma('foreign_keys = ON')
    initialize?.(db)
    return db
  } catch (error) {
    db.close()
    throw error
  }
}
