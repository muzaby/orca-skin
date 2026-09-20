// `_migrations` 메타 테이블의 **단일 사본**.
//
// core DB 와 plugin 파일 DB 가 같은 메타 규약을 쓴다. DDL·조회·기록 SQL 을 각자 적으면 한쪽만
// 바뀌어도 조용히 갈리고, 그 어긋남은 마이그레이션이 이미 적용된 뒤에야 보인다. 정책(백업·
// 미지 마이그레이션 판정·로깅)은 호출자가 갖고, 여기에는 리터럴만 둔다.

// better-sqlite3 의 구조적 최소 계약. 파일 DB 테스트가 `Database` 전체를 세우지 않아도 된다.
export interface MigrationMetaDb {
  exec(sql: string): void
  prepare(sql: string): { run(...args: unknown[]): unknown; all(...args: unknown[]): unknown[] }
}

const META_TABLE = `
  CREATE TABLE IF NOT EXISTS _migrations (
    name TEXT PRIMARY KEY,
    applied_at INTEGER NOT NULL
  )
`

/** 메타 테이블을 보장하고 이미 적용된 이름을 읽는다. */
export function readAppliedMigrations(db: MigrationMetaDb): Set<string> {
  db.exec(META_TABLE)
  const rows = db.prepare('SELECT name FROM _migrations').all() as { name: string }[]
  return new Set(rows.map((row) => row.name))
}

/** 적용 기록기. statement 를 한 번 준비해 루프에서 재사용한다. */
export function migrationRecorder(db: MigrationMetaDb): (name: string, appliedAt?: number) => void {
  const statement = db.prepare('INSERT INTO _migrations (name, applied_at) VALUES (?, ?)')
  return (name, appliedAt = Date.now()) => void statement.run(name, appliedAt)
}
