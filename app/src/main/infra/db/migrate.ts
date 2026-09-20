import { existsSync, mkdirSync, statSync, statfsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import type Database from 'better-sqlite3'
import { getLogger } from '../log/registry'
import { applySqliteMigrations } from './open'
import { PRODUCT_SLUG } from '../../../shared/product'
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
import migration0015 from './migrations/0015_pinned.sql?raw'
import migration0016 from './migrations/0016_turn_model_context_window.sql?raw'
import migration0017 from './migrations/0017_session_extra_dirs.sql?raw'
import migration0018 from './migrations/0018_managed_worktrees.sql?raw'
import migration0019 from './migrations/0019_session_baseline.sql?raw'
import migration0020 from './migrations/0020_session_baseline_ref.sql?raw'
import migration0021 from './migrations/0021_artifacts.sql?raw'
import migration0022 from './migrations/0022_session_agent_kind.sql?raw'
import migration0023 from './migrations/0023_session_agent_kind_code.sql?raw'
import migration0024 from './migrations/0024_artifact_preview_formats.sql?raw'
import migration0025 from './migrations/0025_artifact_catalog.sql?raw'
import migration0026 from './migrations/0026_project_paths.sql?raw'
import migration0027 from './migrations/0027_background_events.sql?raw'

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
  { name: '0014_provider_usage_report_cache', sql: migration0014 },
  { name: '0015_pinned', sql: migration0015 },
  { name: '0016_turn_model_context_window', sql: migration0016 },
  { name: '0017_session_extra_dirs', sql: migration0017 },
  { name: '0018_managed_worktrees', sql: migration0018 },
  { name: '0019_session_baseline', sql: migration0019 },
  { name: '0020_session_baseline_ref', sql: migration0020 },
  { name: '0021_artifacts', sql: migration0021 },
  { name: '0022_session_agent_kind', sql: migration0022 },
  { name: '0023_session_agent_kind_code', sql: migration0023 },
  { name: '0024_artifact_preview_formats', sql: migration0024 },
  { name: '0025_artifact_catalog', sql: migration0025 },
  { name: '0026_project_paths', sql: migration0026 },
  { name: '0027_background_events', sql: migration0027 }
]

export const MIGRATION_NAMES = MIGRATIONS.map((m) => m.name)
export const DB_SCHEMA_TOO_NEW = 'DB_SCHEMA_TOO_NEW'

class DbSchemaTooNewError extends Error {
  readonly code = DB_SCHEMA_TOO_NEW
  readonly unknownMigrations: string[]

  constructor(unknownMigrations: string[]) {
    super(`DB schema is newer than this app understands: ${unknownMigrations.join(', ')}`)
    this.name = 'DbSchemaTooNewError'
    this.unknownMigrations = unknownMigrations
  }
}

interface MigrationBackupOptions {
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
    `${PRODUCT_SLUG}.db.backup.before-${safeVersion(options.appVersion)}.${timestampForFilename(
      options.now?.() ?? new Date()
    )}`
  )
  db.exec(`VACUUM INTO ${sqlString(backupPath)}`)
  return backupPath
}

// 적용 **절차** 는 `infra/db/open.ts` 가 소유한다 (0237 ΔV2 — D-056). 여기 남는 것은 Core DB
// 고유의 두 가지다 — 마이그레이션 **목록**(위 `?raw` import, append-only 가드의 앵커)과
// 백업·로깅 정책. 두 번째 DB 도 같은 절차를 타므로 PRAGMA·트랜잭션·미지 마이그레이션 판정이
// 사본으로 갈리지 않는다.
export function applyMigrations(db: Database.Database, options: ApplyMigrationsOptions = {}): void {
  const log = getLogger().child('db')
  let startedAt = 0
  applySqliteMigrations(db, {
    migrations: MIGRATIONS,
    onUnknown: (unknown) => {
      throw new DbSchemaTooNewError([...unknown])
    },
    beforeMigrate: (pending) => {
      // DB 마이그레이션 경계(0124 카탈로그) — 이름·개수·소요만 기록(값/데이터 금지).
      startedAt = Date.now()
      log.info('db.migration.started', {
        pending: pending.length,
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
    },
    afterMigrate: (applied) => {
      log.info('db.migration.completed', {
        applied: applied.length,
        to: applied[applied.length - 1].name,
        durationMs: Date.now() - startedAt
      })
    }
  })
}
