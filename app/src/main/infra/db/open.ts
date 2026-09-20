// SQLite 열기의 단일 지점 (0237 ΔV2 — D-056).
//
// **왜 infra 인가**: 0237 r2 까지 두 번째 DB 를 여는 코드가 feature 슬라이스에 있었다
// (`features/plugins/mail/store/index.ts` 의 `new Database` + PRAGMA 2줄 + 자체 `_migrations`
// 루프). Core DB 는 `infra/db/index.ts` 가 같은 일을 다른 문장으로 하고 있었고, 그래서
// **PRAGMA 조합과 마이그레이션 규칙이 두 사본으로 갈려 있었다** — 세 번째 플러그인이 DB 를
// 쓰면 세 번째 사본이 생긴다.
//
// 여기서 두 사본을 하나로 접는다. Core 도 플러그인도 이 함수를 통과한다.
//
// ── 여기 없는 것 ──────────────────────────────────────────────────────────────
// 마이그레이션 **목록**은 여기 없다. 목록은 각 DB 의 `migrate.ts` 가 `?raw` import 로 갖고
// (append-only 가드가 그 파일에 앵커돼 있다), 이 함수는 **적용 절차**만 소유한다.
//
// 레이어: infra → infra·shared. electron 을 import 하지 않는다 — 경로는 호출자가 준다.

import Database from 'better-sqlite3'
import { dirname } from 'node:path'
import { mkdirSync } from 'node:fs'

export interface SqliteMigration {
  name: string
  sql: string
}

export interface OpenSqliteOptions {
  /** DB 파일 절대 경로. 상위 디렉터리는 없으면 만든다. */
  path: string
  /**
   * 순서대로 적용할 마이그레이션. **append-only** 다 — 이미 적용된 이름은 건너뛰고,
   * 목록에 없는 이름이 DB 에 있으면 호출자가 판정한다(`onUnknown`).
   */
  migrations: readonly SqliteMigration[]
  /**
   * DB 에는 있는데 목록에 없는 마이그레이션 이름을 만났을 때. 미지정이면 **무시하지 않고
   * throw** 한다 — 구버전 앱이 신버전 스키마를 여는 상황이라 조용히 진행하면 안 된다.
   */
  onUnknown?: (names: readonly string[]) => never
  /** 첫 마이그레이션 적용 **직전** 1회. Core DB 의 백업 훅이 여기 붙는다. */
  beforeMigrate?: (pending: readonly SqliteMigration[]) => void
  /** 마지막 마이그레이션 적용 직후 1회. */
  afterMigrate?: (applied: readonly SqliteMigration[]) => void
}

const META_TABLE = `
  CREATE TABLE IF NOT EXISTS _migrations (
    name TEXT PRIMARY KEY,
    applied_at INTEGER NOT NULL
  )
`

export class SqliteSchemaTooNewError extends Error {
  constructor(readonly unknown: readonly string[]) {
    // 이름만 싣는다 — 경로·데이터는 로그에 남기지 않는다.
    super(`알 수 없는 마이그레이션이 이미 적용돼 있습니다: ${unknown.join(', ')}`)
    this.name = 'SqliteSchemaTooNewError'
  }
}

/**
 * 마이그레이션까지 끝난 연결을 돌려준다.
 *
 * PRAGMA 조합은 0107 의 결정을 승계한다 — `WAL` + `synchronous=NORMAL`(앱 크래시 무손실,
 * 정전 시에만 최근 커밋 롤백) + `foreign_keys=ON`. **여기가 그 조합의 유일한 선언이다.**
 */
export function openSqlite(options: OpenSqliteOptions): Database.Database {
  const db = openSqliteConnection(options.path)
  applySqliteMigrations(db, options)
  return db
}

/**
 * 연결과 PRAGMA 까지만. 마이그레이션을 **다른 정책과 함께** 적용해야 하는 호출자용이다 —
 * Core DB 는 마이그레이션 직전에 백업을 뜨므로 `applyMigrations`(`./migrate.ts`)를 따로 부른다.
 */
export function openSqliteConnection(path: string): Database.Database {
  mkdirSync(dirname(path), { recursive: true })
  const db = new Database(path)
  db.pragma('journal_mode = WAL')
  // WAL 권장 조합(0107) — FULL(기본)은 커밋마다 fsync 해 스트리밍 persist 가 이벤트 루프를
  // 점유한다. NORMAL 은 앱 크래시 무손실, 정전 시에만 최근 커밋 롤백(DB 무결성 보존).
  db.pragma('synchronous = NORMAL')
  db.pragma('foreign_keys = ON')
  return db
}

/**
 * 이미 열린 연결에 마이그레이션만 적용한다. 테스트가 in-memory 연결로 스키마만 세울 때 쓴다.
 */
export function applySqliteMigrations(
  db: Database.Database,
  options: Pick<OpenSqliteOptions, 'migrations' | 'onUnknown' | 'beforeMigrate' | 'afterMigrate'>
): void {
  db.exec(META_TABLE)
  const applied = new Set(
    (db.prepare('SELECT name FROM _migrations').all() as { name: string }[]).map((row) => row.name)
  )
  const known = new Set(options.migrations.map((migration) => migration.name))
  const unknown = [...applied].filter((name) => !known.has(name)).sort()
  if (unknown.length > 0) {
    if (options.onUnknown) options.onUnknown(unknown)
    throw new SqliteSchemaTooNewError(unknown)
  }

  const pending = options.migrations.filter((migration) => !applied.has(migration.name))
  if (pending.length === 0) return
  options.beforeMigrate?.(pending)
  const record = db.prepare('INSERT INTO _migrations (name, applied_at) VALUES (?, ?)')
  for (const migration of pending) {
    // 한 마이그레이션은 한 트랜잭션이다 — 중간에 죽어도 절반 적용된 스키마가 남지 않는다.
    db.transaction(() => {
      db.exec(migration.sql)
      record.run(migration.name, Date.now())
    })()
  }
  options.afterMigrate?.(pending)
}
