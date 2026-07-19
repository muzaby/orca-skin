import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import Database from 'better-sqlite3'
import { afterEach, describe, expect, it } from 'vitest'
import migration0001 from './migrations/0001_initial.sql?raw'
import migration0002 from './migrations/0002_projects.sql?raw'
import migration0003 from './migrations/0003_messages_fts.sql?raw'
import migration0004 from './migrations/0004_message_parts.sql?raw'
import migration0005 from './migrations/0005_usage_events.sql?raw'
import migration0006 from './migrations/0006_turn_usage.sql?raw'
import {
  DB_SCHEMA_TOO_NEW,
  MIGRATION_NAMES,
  applyMigrations,
  createMigrationBackup
} from './migrate'

const EXPECTED_MIGRATIONS = [
  '0001_initial',
  '0002_projects',
  '0003_messages_fts',
  '0004_message_parts',
  '0005_usage_events',
  '0006_turn_usage',
  '0007_title_source',
  '0008_provider_key',
  '0009_message_complete',
  '0010_session_cwd',
  '0011_session_lineage',
  '0012_provider_limits',
  '0013_schedules',
  '0014_provider_usage_report_cache',
  '0015_pinned'
]

const APPLIED_SQL = [
  ['0001_initial', migration0001],
  ['0002_projects', migration0002],
  ['0003_messages_fts', migration0003],
  ['0004_message_parts', migration0004],
  ['0005_usage_events', migration0005],
  ['0006_turn_usage', migration0006]
] as const

const tmpRoots: string[] = []

function tmpRoot(): string {
  const dir = mkdtempSync(join(tmpdir(), 'orca-migrate-'))
  tmpRoots.push(dir)
  return dir
}

function createFileDb(): { db: Database.Database; path: string; root: string } {
  const root = tmpRoot()
  const path = join(root, 'orca.db')
  const db = new Database(path)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  return { db, path, root }
}

function applyFirstSix(db: Database.Database): void {
  db.exec(
    `CREATE TABLE IF NOT EXISTS _migrations (name TEXT PRIMARY KEY, applied_at INTEGER NOT NULL)`
  )
  const record = db.prepare('INSERT INTO _migrations (name, applied_at) VALUES (?, ?)')
  for (const [name, sql] of APPLIED_SQL) {
    db.exec(sql)
    record.run(name, 1)
  }
}

afterEach(() => {
  for (const root of tmpRoots.splice(0)) rmSync(root, { recursive: true, force: true })
})

describe('DB migrations hardening', () => {
  it('마이그레이션 이름과 순서를 고정한다', () => {
    expect(MIGRATION_NAMES).toEqual(EXPECTED_MIGRATIONS)
  })

  it('앱이 모르는 미래 마이그레이션이 적용된 DB는 명확히 거부한다', () => {
    const db = new Database(':memory:')
    db.exec(`CREATE TABLE _migrations (name TEXT PRIMARY KEY, applied_at INTEGER NOT NULL)`)
    db.prepare('INSERT INTO _migrations (name, applied_at) VALUES (?, ?)').run(
      '9999_future_schema',
      1
    )

    expect(() => applyMigrations(db)).toThrow(/DB schema is newer/)
    try {
      applyMigrations(db)
    } catch (e) {
      expect((e as { code?: string }).code).toBe(DB_SCHEMA_TOO_NEW)
    }
    db.close()
  })

  it('부분 적용된 오래된 DB를 최신까지 한 번에 전진시킨다', () => {
    const db = new Database(':memory:')
    applyFirstSix(db)

    applyMigrations(db)

    const rows = db.prepare('SELECT name FROM _migrations ORDER BY name').pluck().all()
    expect(rows).toEqual(EXPECTED_MIGRATIONS)
    expect(
      db.prepare(`SELECT name FROM sqlite_master WHERE name = 'schedule_runs'`).get()
    ).toBeTruthy()
    db.close()
  })

  it('WAL 내용을 포함한 복구 가능한 마이그레이션 전 백업을 만든다', () => {
    const { db, path, root } = createFileDb()
    applyFirstSix(db)
    db.prepare(
      `INSERT INTO sessions (id, backend, title, project_id, created_at, updated_at, last_message_preview)
       VALUES ('s1', 'claude', 'before', NULL, 1, 1, NULL)`
    ).run()

    applyMigrations(db, {
      backup: {
        databasePath: path,
        backupDir: root,
        appVersion: '1.100.0',
        now: () => new Date('2026-07-08T00:00:00.000Z'),
        minFreeBytes: 0
      }
    })

    const backupPath = join(root, 'orca.db.backup.before-1.100.0.2026-07-08T00-00-00-000Z')
    expect(existsSync(backupPath)).toBe(true)
    const backup = new Database(backupPath, { readonly: true })
    expect(backup.pragma('integrity_check', { simple: true })).toBe('ok')
    expect(backup.prepare(`SELECT title FROM sessions WHERE id = 's1'`).pluck().get()).toBe(
      'before'
    )
    expect(backup.prepare('SELECT name FROM _migrations ORDER BY name').pluck().all()).toEqual(
      EXPECTED_MIGRATIONS.slice(0, 6)
    )
    backup.close()

    expect(db.prepare('SELECT name FROM _migrations ORDER BY name').pluck().all()).toEqual(
      EXPECTED_MIGRATIONS
    )
    db.close()
  })

  it('백업 실패 시 신규 마이그레이션을 적용하지 않는다', () => {
    const { db, path, root } = createFileDb()
    applyFirstSix(db)

    expect(() =>
      applyMigrations(db, {
        backup: {
          databasePath: path,
          backupDir: root,
          appVersion: '1.100.0',
          minFreeBytes: Number.MAX_SAFE_INTEGER
        }
      })
    ).toThrow(/Not enough free disk space/)

    expect(db.prepare('SELECT name FROM _migrations ORDER BY name').pluck().all()).toEqual(
      EXPECTED_MIGRATIONS.slice(0, 6)
    )
    db.close()
  })

  it('미적용 마이그레이션이 없으면 백업을 만들지 않는다', () => {
    const { db, path, root } = createFileDb()
    applyMigrations(db)

    applyMigrations(db, {
      backup: {
        databasePath: path,
        backupDir: root,
        appVersion: '1.100.0',
        now: () => new Date('2026-07-08T00:00:00.000Z'),
        minFreeBytes: 0
      }
    })

    expect(existsSync(join(root, 'orca.db.backup.before-1.100.0.2026-07-08T00-00-00-000Z'))).toBe(
      false
    )
    db.close()
  })

  it('백업 API는 단독으로 복구 가능한 스냅샷을 만든다', () => {
    const { db, path, root } = createFileDb()
    applyFirstSix(db)
    const backupPath = createMigrationBackup(db, {
      databasePath: path,
      backupDir: root,
      appVersion: '1.0.0',
      now: () => new Date('2026-07-08T00:00:00.000Z'),
      minFreeBytes: 0
    })

    const backup = new Database(backupPath, { readonly: true })
    expect(backup.pragma('integrity_check', { simple: true })).toBe('ok')
    backup.close()
    db.close()
  })
})
