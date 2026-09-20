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

// 이관 1회 경로 재기입(0225 `app/legacy-paths.ts`) 전용 접근자. `DbQueries` 는 도메인 질의만
// 노출하고, 컬럼 전수를 훑는 일회성 데이터 갱신은 raw 연결이 필요하다. **소비자는 컴포지션
// 루트 한 곳이다** — 도메인 코드가 이걸 쓰기 시작하면 prepared statement 계층이 무의미해진다.
export function getDbConnection(): Database.Database | null {
  return connection
}

export function closeDb(): void {
  if (connection) {
    connection.close()
    connection = null
    queries = null
  }
}

export type { DbQueries }
