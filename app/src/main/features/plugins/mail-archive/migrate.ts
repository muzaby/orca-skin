import type Database from 'better-sqlite3'
import {
  migrationRecorder,
  readAppliedMigrations,
  type MigrationMetaDb
} from '../../../infra/db/migration-meta'
import migration0001 from './migrations/0001_mail_archive.sql?raw'
import migration0002 from './migrations/0002_source_revisions.sql?raw'
import migration0003 from './migrations/0003_confirmed_relations.sql?raw'
import migration0004 from './migrations/0004_body_quality_projection.sql?raw'

import migration0005 from './migrations/0005_verified_history.sql?raw'
import migration0006 from './migrations/0006_body_segments.sql?raw'
import migration0007 from './migrations/0007_builtin_mcp.sql?raw'

const MAIL_ARCHIVE_MIGRATIONS = [
  { name: '0001_mail_archive', sql: migration0001 },
  { name: '0002_source_revisions', sql: migration0002 },
  { name: '0003_confirmed_relations', sql: migration0003 },
  { name: '0004_body_quality_projection', sql: migration0004 },
  { name: '0005_verified_history', sql: migration0005 },
  { name: '0006_body_segments', sql: migration0006 },
  { name: '0007_builtin_mcp', sql: migration0007 }
] as const

type MailArchiveMigrationName = (typeof MAIL_ARCHIVE_MIGRATIONS)[number]['name']

export function applyMailArchiveMigrations(
  db: Database.Database,
  through?: MailArchiveMigrationName
): void {
  const migrationDb = db as unknown as MigrationMetaDb
  const applied = readAppliedMigrations(migrationDb)
  const record = migrationRecorder(migrationDb)
  let reachedTarget = through === undefined

  for (const migration of MAIL_ARCHIVE_MIGRATIONS) {
    if (!applied.has(migration.name)) {
      db.transaction(() => {
        db.exec(migration.sql)
        record(migration.name)
      })()
    }
    if (migration.name === through) {
      reachedTarget = true
      break
    }
  }

  if (!reachedTarget) throw new Error(`unknown_mail_archive_migration:${through}`)
}
