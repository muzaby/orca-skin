import {
  migrationRecorder,
  readAppliedMigrations,
  type MigrationMetaDb
} from '../../../../infra/db/migration-meta'
import migration0001 from '../migrations/0001_mail.sql?raw'

const MAIL_MIGRATIONS = [{ name: '0001_mail', sql: migration0001 }] as const

export const MAIL_MIGRATION_NAMES = MAIL_MIGRATIONS.map((migration) => migration.name)

export function applyMailMigrations(db: MigrationMetaDb): void {
  const applied = readAppliedMigrations(db)
  const record = migrationRecorder(db)
  for (const migration of MAIL_MIGRATIONS) {
    if (applied.has(migration.name)) continue
    db.exec(migration.sql)
    record(migration.name)
  }
}
