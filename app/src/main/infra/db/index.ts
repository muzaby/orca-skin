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
  // WAL 권장 조합(0107) — FULL(기본)은 커밋마다 fsync 해 스트리밍 persist 가 이벤트 루프를
  // 점유한다. NORMAL 은 앱 크래시 무손실, 정전 시에만 최근 커밋 롤백(DB 무결성 보존).
  connection.pragma('synchronous = NORMAL')
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
