import Database from 'better-sqlite3'
import { app } from 'electron'
import { join } from 'path'
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
