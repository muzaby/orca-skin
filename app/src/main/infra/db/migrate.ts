import { existsSync, mkdirSync, statSync, statfsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import type Database from 'better-sqlite3'
import { getLogger } from '../log/registry'
import migration0001 from './migrations/0001_initial.sql?raw'
import migration0002 from './migrations/0002_projects.sql?raw'
import migration0003 from './migrations/0003_messages_fts.sql?raw'
import migration0004 from './migrations/0004_message_parts.sql?raw'
import migration0005 from './migrations/0005_usage_events.sql?raw'
import migration0006 from './migrations/0006_turn_usage.sql?raw'
import migration0007 from './migrations/0007_title_source.sql?raw'
import migration0008 from './migrations/0008_provider_key.sql?raw'
import migration0009 from './migrations/0009_message_complete.sql?raw'
import migration0010 from './migrations/0010_session_cwd.sql?raw'
import migration0011 from './migrations/0011_session_lineage.sql?raw'
import migration0012 from './migrations/0012_provider_limits.sql?raw'
import migration0013 from './migrations/0013_schedules.sql?raw'
import migration0014 from './migrations/0014_provider_usage_report_cache.sql?raw'

interface Migration {
  name: string
  sql: string
}

const MIGRATIONS: Migration[] = [
  { name: '0001_initial', sql: migration0001 },
  { name: '0002_projects', sql: migration0002 },
  { name: '0003_messages_fts', sql: migration0003 },
  { name: '0004_message_parts', sql: migration0004 },
  { name: '0005_usage_events', sql: migration0005 },
  { name: '0006_turn_usage', sql: migration0006 },
  { name: '0007_title_source', sql: migration0007 },
  { name: '0008_provider_key', sql: migration0008 },
  { name: '0009_message_complete', sql: migration0009 },
  { name: '0010_session_cwd', sql: migration0010 },
  { name: '0011_session_lineage', sql: migration0011 },
  { name: '0012_provider_limits', sql: migration0012 },
  { name: '0013_schedules', sql: migration0013 },
  { name: '0014_provider_usage_report_cache', sql: migration0014 }
]

export const MIGRATION_NAMES = MIGRATIONS.map((m) => m.name)
export const DB_SCHEMA_TOO_NEW = 'DB_SCHEMA_TOO_NEW'

export class DbSchemaTooNewError extends Error {
  readonly code = DB_SCHEMA_TOO_NEW
  readonly unknownMigrations: string[]

  constructor(unknownMigrations: string[]) {
    super(`DB schema is newer than this app understands: ${unknownMigrations.join(', ')}`)
    this.name = 'DbSchemaTooNewError'
    this.unknownMigrations = unknownMigrations
  }
}

export interface MigrationBackupOptions {
  databasePath: string
  backupDir?: string
  appVersion: string
  now?: () => Date
  minFreeBytes?: number
}

export interface ApplyMigrationsOptions {
  backup?: MigrationBackupOptions
  onBackupStart?: () => void
  onBackupEnd?: () => void
}

const META_TABLE = `
  CREATE TABLE IF NOT EXISTS _migrations (
    name TEXT PRIMARY KEY,
    applied_at INTEGER NOT NULL
  )
`

function timestampForFilename(date: Date): string {
  return date.toISOString().replace(/[:.]/g, '-')
}

function safeVersion(version: string): string {
  return version.replace(/[^0-9A-Za-z._-]/g, '_')
}

function sqlString(value: string): string {
  return `'${value.replace(/'/g, "''")}'`
}

function fileSizeIfExists(path: string): number {
  return existsSync(path) ? statSync(path).size : 0
}

function requiredFreeBytes(databasePath: string, configured?: number): number {
  if (configured !== undefined) return configured
  const current =
    fileSizeIfExists(databasePath) +
    fileSizeIfExists(`${databasePath}-wal`) +
    fileSizeIfExists(`${databasePath}-shm`)
  return Math.max(current * 2, 1024 * 1024)
}

function assertEnoughFreeSpace(targetDir: string, requiredBytes: number): void {
  const statfs = statfsSync(statSync(targetDir).isDirectory() ? targetDir : dirname(targetDir))
  const freeBytes = Number(statfs.bavail) * Number(statfs.bsize)
  if (freeBytes < requiredBytes) {
    throw new Error(
      `Not enough free disk space for DB migration backup: required=${requiredBytes}, available=${freeBytes}`
    )
  }
}

export function createMigrationBackup(
  db: Database.Database,
  options: MigrationBackupOptions
): string {
  const backupDir = options.backupDir ?? dirname(options.databasePath)
  mkdirSync(backupDir, { recursive: true })
  assertEnoughFreeSpace(backupDir, requiredFreeBytes(options.databasePath, options.minFreeBytes))
  const backupPath = join(
    backupDir,
    `orca.db.backup.before-${safeVersion(options.appVersion)}.${timestampForFilename(
      options.now?.() ?? new Date()
    )}`
  )
  db.exec(`VACUUM INTO ${sqlString(backupPath)}`)
  return backupPath
}

export function applyMigrations(db: Database.Database, options: ApplyMigrationsOptions = {}): void {
  db.exec(META_TABLE)
  const applied = new Set(
    (db.prepare('SELECT name FROM _migrations').all() as { name: string }[]).map((r) => r.name)
  )
  const known = new Set(MIGRATION_NAMES)
  const unknown = [...applied].filter((name) => !known.has(name)).sort()
  if (unknown.length > 0) throw new DbSchemaTooNewError(unknown)

  const pending = MIGRATIONS.filter((m) => !applied.has(m.name))
  if (pending.length === 0) return
  // DB 마이그레이션 경계(0124 카탈로그) — 이름·개수·소요만 기록(값/데이터 금지).
  const log = getLogger().child('db')
  const startedAt = Date.now()
  log.info('db.migration.started', {
    pending: pending.length,
    from: [...applied].sort().at(-1) ?? null,
    to: pending[pending.length - 1].name
  })
  if (options.backup) {
    options.onBackupStart?.()
    try {
      createMigrationBackup(db, options.backup)
    } finally {
      options.onBackupEnd?.()
    }
  }

  const record = db.prepare('INSERT INTO _migrations (name, applied_at) VALUES (?, ?)')
  for (const m of pending) {
    const apply = db.transaction(() => {
      db.exec(m.sql)
      record.run(m.name, Date.now())
    })
    try {
      apply()
    } catch (err) {
      log.error('db.migration.failed', err, { migration: m.name })
      throw err
    }
  }
  log.info('db.migration.completed', {
    applied: pending.length,
    to: pending[pending.length - 1].name,
    durationMs: Date.now() - startedAt
  })
}
