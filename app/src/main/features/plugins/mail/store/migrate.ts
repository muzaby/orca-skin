import {
  migrationRecorder,
  readAppliedMigrations,
  type MigrationMetaDb
} from '../../../../infra/db/migration-meta'
import migration0001 from '../migrations/0001_mail.sql?raw'
import migration0002 from '../migrations/0002_mail_body_source.sql?raw'

export interface MailMigration {
  readonly name: string
  readonly sql: string
}

export const MAIL_MIGRATIONS: readonly MailMigration[] = [
  { name: '0001_mail', sql: migration0001 },
  { name: '0002_mail_body_source', sql: migration0002 }
]

// 마이그레이션 한 건의 SQL 과 `_migrations` 기록을 한 트랜잭션으로 적용한다 (0302 D-006).
// `ALTER TABLE … ADD COLUMN` 은 재실행이 `duplicate column` 으로 실패한다 — 기록 전에 중단되면
// 그 계정 store 가 다시 열리지 않는다. 실패하면 스키마 변경도 기록도 남지 않는다.
export function applyMigrationList(
  db: MigrationMetaDb,
  migrations: readonly MailMigration[]
): void {
  const applied = readAppliedMigrations(db)
  const record = migrationRecorder(db)
  for (const migration of migrations) {
    if (applied.has(migration.name)) continue
    db.exec('BEGIN')
    try {
      db.exec(migration.sql)
      record(migration.name)
      db.exec('COMMIT')
    } catch (error) {
      db.exec('ROLLBACK')
      throw error
    }
  }
}

export function applyMailMigrations(db: MigrationMetaDb): void {
  applyMigrationList(db, MAIL_MIGRATIONS)
}
