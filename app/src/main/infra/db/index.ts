import type Database from 'better-sqlite3'
import { app } from 'electron'
import { join } from 'path'
import { openFileDatabase } from './file-database'
import { applyMigrations, type ApplyMigrationsOptions } from './migrate'
import { DbQueries } from './queries'
import { PRODUCT_SLUG } from '../../../shared/product'

let queries: DbQueries | null = null
let connection: Database.Database | null = null

export function initDb(
  options: Pick<ApplyMigrationsOptions, 'onBackupStart' | 'onBackupEnd'> = {}
): DbQueries {
  if (queries) return queries
  const userData = app.getPath('userData')
  const databasePath = join(userData, `${PRODUCT_SLUG}.db`)
  // PRAGMA 한 벌(WAL · synchronous=NORMAL(0107) · foreign_keys)은 `openFileDatabase` 가 갖는다 —
  // 코어와 plugin 파일 DB 가 같은 내구성 설정을 쓰게 하는 단일 사본이다. 마이그레이션이 던지면
  // 연결은 열린 채 남지 않고 닫힌다.
  connection = openFileDatabase(databasePath, {
    initialize: (db) =>
      applyMigrations(db, {
        backup: {
          databasePath,
          backupDir: userData,
          appVersion: app.getVersion()
        },
        onBackupStart: options.onBackupStart,
        onBackupEnd: options.onBackupEnd
      })
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
