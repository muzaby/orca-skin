import Database from 'better-sqlite3'
import { app } from 'electron'
import { join } from 'path'
import { applyMigrations, type ApplyMigrationsOptions } from './migrate'
import { DbQueries } from './queries'

let queries: DbQueries | null = null
let connection: Database.Database | null = null

export function initDb(
  options: Pick<ApplyMigrationsOptions, 'onBackupStart' | 'onBackupEnd'> = {}
): DbQueries {
  if (queries) return queries
  const userData = app.getPath('userData')
  const databasePath = join(userData, 'orca.db')
  connection = new Database(databasePath)
  connection.pragma('journal_mode = WAL')
  connection.pragma('foreign_keys = ON')
  applyMigrations(connection, {
    backup: {
      databasePath,
      backupDir: userData,
      appVersion: app.getVersion()
    },
    onBackupStart: options.onBackupStart,
    onBackupEnd: options.onBackupEnd
  })
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
