import Database from 'better-sqlite3'
import { app } from 'electron'
import { join } from 'path'
import { applyMigrations } from './migrate'
import { DbQueries } from './queries'

let queries: DbQueries | null = null
let connection: Database.Database | null = null

export function initDb(): DbQueries {
  if (queries) return queries
  connection = new Database(join(app.getPath('userData'), 'orca.db'))
  connection.pragma('journal_mode = WAL')
  connection.pragma('foreign_keys = ON')
  applyMigrations(connection)
  queries = new DbQueries(connection)
  return queries
}

export function closeDb(): void {
  if (connection) {
    connection.close()
    connection = null
    queries = null
  }
}

export type { DbQueries }
