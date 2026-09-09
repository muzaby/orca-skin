import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import Database from 'better-sqlite3'
import { DbQueries } from './queries'
import { afterEach, describe, expect, it } from 'vitest'
import migration0001 from './migrations/0001_initial.sql?raw'
import migration0002 from './migrations/0002_projects.sql?raw'
import migration0003 from './migrations/0003_messages_fts.sql?raw'
import migration0004 from './migrations/0004_message_parts.sql?raw'
import migration0005 from './migrations/0005_usage_events.sql?raw'
import migration0006 from './migrations/0006_turn_usage.sql?raw'
import migration0007 from './migrations/0007_title_source.sql?raw'
import migration0008 from './migrations/0008_provider_key.sql?raw'
import migration0009 from './migrations/0009_message_complete.sql?raw'
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
  '0015_pinned',
  '0016_turn_model_context_window',
  '0017_session_extra_dirs',
  '0018_managed_worktrees',
  '0019_session_baseline',
  '0020_session_baseline_ref',
  '0021_artifacts',
  '0022_session_agent_kind',
  '0023_session_agent_kind_code'
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
    db.prepare(
      `INSERT INTO sessions (id, backend, title, project_id, created_at, updated_at, last_message_preview)
       VALUES ('legacy-session', 'claude', 'before', NULL, 1, 1, NULL)`
    ).run()

    applyMigrations(db)

    const rows = db.prepare('SELECT name FROM _migrations ORDER BY name').pluck().all()
    expect(rows).toEqual(EXPECTED_MIGRATIONS)
    expect(
      db.prepare(`SELECT name FROM sqlite_master WHERE name = 'schedule_runs'`).get()
    ).toBeTruthy()
    expect(
      db.prepare(`SELECT title, baseline_oid FROM sessions WHERE id = 'legacy-session'`).get()
    ).toEqual({
      title: 'before',
      baseline_oid: null
    })
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

// ── 마이그레이션 SQL 자체의 동작 ────────────────────────────────────────────
// 아래 두 describe 는 **그 시점의 오래된 DB** 를 손으로 세우고 마이그레이션 한 장을 적용해
// 데이터가 어떻게 옮겨지는지를 검사한다. 여기 쓰이는 목록은 과거에 고정된 부분집합이라 새
// 마이그레이션을 따라가지 않는다 — 그래서 정본(`applyMigrations`)을 쓸 수 없고, 이 파일이
// 마이그레이션 목록을 손으로 적어도 되는 유일한 곳인 이유다(골든 목록과 같은 성격).
function memDb(...sqls: string[]): Database.Database {
  const db = new Database(':memory:')
  db.pragma('foreign_keys = ON')
  for (const sql of sqls) db.exec(sql)
  return db
}

function insertSession(db: Database.Database, id = 's1'): void {
  db.prepare(
    `INSERT INTO sessions (id, backend, title, project_id, created_at, updated_at, last_message_preview, provider_key)
     VALUES (?, 'claude', NULL, NULL, 1, 1, NULL, NULL)`
  ).run(id)
}

describe('0006_turn_usage migration', () => {
  it('usage_events 데이터를 id 보존 turn_usage/turn_model_usage 로 이관하고 기존 테이블을 제거한다', () => {
    const db = memDb(migration0001, migration0002, migration0003, migration0004, migration0005)
    db.prepare(
      `INSERT INTO sessions (id, backend, title, project_id, created_at, updated_at, last_message_preview)
       VALUES ('s1', 'claude', NULL, NULL, 1, 1, NULL)`
    ).run()
    db.prepare(
      `INSERT INTO usage_events
       (id, session_id, model, created_at, input_tokens, output_tokens, cache_read_tokens,
        cache_creation_tokens, cost_usd)
       VALUES (42, 's1', 'claude-opus-4-5', 1000, 10, 20, 30, 40, 0.5)`
    ).run()

    db.exec(migration0006)

    expect(
      db.prepare(`SELECT name FROM sqlite_master WHERE name = 'usage_events'`).get()
    ).toBeUndefined()
    expect(db.prepare('SELECT * FROM turn_usage').get()).toMatchObject({
      id: 42,
      session_id: 's1',
      message_id: null,
      input_tokens: 10,
      output_tokens: 20,
      cache_read_input_tokens: 30,
      cache_creation_input_tokens: 40,
      total_cost_usd: 0.5,
      created_at: 1000
    })
    expect(db.prepare('SELECT * FROM turn_model_usage').get()).toMatchObject({
      turn_usage_id: 42,
      model: 'claude-opus-4-5',
      input_tokens: 10,
      output_tokens: 20,
      cache_read_input_tokens: 30,
      cache_creation_input_tokens: 40,
      cost_usd: 0.5
    })
  })
})

describe('0009_message_complete migration', () => {
  it('기존 messages 행을 complete=1 로 backfill 한다', () => {
    const db = memDb(
      migration0001,
      migration0002,
      migration0003,
      migration0004,
      migration0005,
      migration0006,
      migration0007,
      migration0008
    )
    insertSession(db)
    db.prepare(
      `INSERT INTO messages (session_id, role, content, created_at, idx)
       VALUES ('s1', 'assistant', 'old', 1, 0)`
    ).run()

    db.exec(migration0009)

    expect(db.prepare('SELECT complete FROM messages').get()).toEqual({ complete: 1 })
  })
})

it('upgrades an existing pre-kind session to Code without changing messages or metadata', () => {
  const db = new Database(':memory:')
  try {
    db.exec(migration0001)
    db.exec('CREATE TABLE _migrations (name TEXT PRIMARY KEY, applied_at INTEGER NOT NULL)')
    db.prepare('INSERT INTO _migrations VALUES (?, ?)').run('0001_initial', 1)
    db.prepare(
      'INSERT INTO sessions (id, backend, title, created_at, updated_at, last_message_preview) VALUES (?, ?, ?, ?, ?, ?)'
    ).run('old', 'claude', 'keep title', 1, 2, 'keep preview')
    db.prepare(
      'INSERT INTO messages (session_id, role, content, created_at, idx) VALUES (?, ?, ?, ?, ?)'
    ).run('old', 'user', 'keep body', 3, 0)
    applyMigrations(db)
    expect(new DbQueries(db).getSessionById('old')).toMatchObject({
      agent_kind: 'code',
      title: 'keep title',
      last_message_preview: 'keep preview',
      updated_at: 2
    })
    expect(db.prepare('SELECT content FROM messages WHERE session_id=?').get('old')).toEqual({
      content: 'keep body'
    })
  } finally {
    db.close()
  }
})

describe('0023_session_agent_kind_code migration', () => {
  const migrationsDir = join(process.cwd(), 'src', 'main', 'infra', 'db', 'migrations')
  const migration0023Path = join(migrationsDir, '0023_session_agent_kind_code.sql')

  function databaseThrough0022(filename = ':memory:'): Database.Database {
    const db = new Database(filename)
    db.pragma('foreign_keys = ON')
    for (const name of readdirSync(migrationsDir)
      .filter((name) => /^00(?:0\d|1\d|2[0-2])_/.test(name))
      .sort()) {
      db.exec(readFileSync(join(migrationsDir, name), 'utf8'))
    }
    return db
  }

  it('moves both values while preserving session indexes, inbound FKs, messages, FTS, and lineage', () => {
    expect(existsSync(migration0023Path)).toBe(true)
    const db = databaseThrough0022()
    try {
      db.prepare(
        'INSERT INTO sessions (id, backend, title, created_at, updated_at, agent_kind) VALUES (?, ?, ?, ?, ?, ?)'
      ).run('parent', 'claude', 'parent', 1, 1, 'work')
      db.prepare(
        'INSERT INTO sessions (id, backend, title, created_at, updated_at, agent_kind) VALUES (?, ?, ?, ?, ?, ?)'
      ).run('child', 'claude', 'child', 1, 1, 'coding')
      db.prepare(
        'INSERT INTO messages (session_id, role, content, created_at, idx) VALUES (?, ?, ?, ?, ?)'
      ).run('child', 'user', 'migration needle', 2, 0)
      db.prepare(
        'INSERT INTO session_lineage (child_session_id, parent_session_id, relation, fork_point_message_idx, created_at) VALUES (?, ?, ?, ?, ?)'
      ).run('child', 'parent', 'fork', null, 3)

      const indexesBefore = db
        .prepare(
          "SELECT name, sql FROM sqlite_master WHERE type='index' AND tbl_name='sessions' ORDER BY name"
        )
        .all()
      const tableNamesBefore = db
        .prepare(
          "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
        )
        .pluck()
        .all() as string[]
      const inboundFksBefore = tableNamesBefore.flatMap((table) =>
        (
          db.pragma(`foreign_key_list(${String(table)})`) as Array<{
            table: string
            [key: string]: unknown
          }>
        )
          .filter((fk) => fk.table === 'sessions')
          .map((fk) => ({ childTable: table, ...fk }))
      )

      db.transaction(() => db.exec(readFileSync(migration0023Path, 'utf8')))()

      expect(db.prepare('SELECT id, agent_kind FROM sessions ORDER BY id').all()).toEqual([
        { id: 'child', agent_kind: 'code' },
        { id: 'parent', agent_kind: 'work' }
      ])
      const sessionsSchema = db
        .prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='sessions'")
        .pluck()
        .get() as string
      expect(sessionsSchema).toMatch(
        /agent_kind TEXT NOT NULL DEFAULT 'code'\s+CHECK \(agent_kind IN \('code',\s*'work'\)\)/
      )
      expect(
        db
          .prepare(
            "SELECT name, sql FROM sqlite_master WHERE type='index' AND tbl_name='sessions' ORDER BY name"
          )
          .all()
      ).toEqual(indexesBefore)
      const tableNamesAfter = db
        .prepare(
          "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
        )
        .pluck()
        .all() as string[]
      const inboundFksAfter = tableNamesAfter.flatMap((table) =>
        (
          db.pragma(`foreign_key_list(${String(table)})`) as Array<{
            table: string
            [key: string]: unknown
          }>
        )
          .filter((fk) => fk.table === 'sessions')
          .map((fk) => ({ childTable: table, ...fk }))
      )
      expect(inboundFksAfter).toEqual(inboundFksBefore)
      expect(db.pragma('foreign_key_check')).toEqual([])
      expect(db.pragma('integrity_check', { simple: true })).toBe('ok')
      expect(
        db
          .prepare("SELECT content FROM messages_fts WHERE messages_fts MATCH 'needle'")
          .pluck()
          .get()
      ).toBe('migration needle')
      expect(
        db
          .prepare('SELECT child_session_id, parent_session_id, relation FROM session_lineage')
          .get()
      ).toEqual({
        child_session_id: 'child',
        parent_session_id: 'parent',
        relation: 'fork'
      })
      db.prepare(
        "INSERT INTO sessions (id, backend, created_at, updated_at) VALUES ('default', 'claude', 4, 4)"
      ).run()
      expect(db.prepare("SELECT agent_kind FROM sessions WHERE id='default'").pluck().get()).toBe(
        'code'
      )
      expect(() =>
        db
          .prepare(
            "INSERT INTO sessions (id, backend, created_at, updated_at, agent_kind) VALUES ('legacy', 'claude', 5, 5, 'coding')"
          )
          .run()
      ).toThrow()
    } finally {
      db.close()
    }
  })

  it('rolls back the schema change when persisted data is corrupt', () => {
    const db = databaseThrough0022()
    try {
      db.pragma('ignore_check_constraints = ON')
      db.prepare(
        "INSERT INTO sessions (id, backend, created_at, updated_at, agent_kind) VALUES ('bad', 'claude', 1, 1, 'corrupt')"
      ).run()
      db.pragma('ignore_check_constraints = OFF')

      expect(() =>
        db.transaction(() => db.exec(readFileSync(migration0023Path, 'utf8')))()
      ).toThrow()
      expect(
        (db.pragma('table_info(sessions)') as Array<{ name: string }>).map((column) => column.name)
      ).not.toContain('agent_kind_next')
      expect(db.prepare("SELECT agent_kind FROM sessions WHERE id='bad'").pluck().get()).toBe(
        'corrupt'
      )
    } finally {
      db.close()
    }
  })

  it('preserves published artifact references, messages, and FTS after close and reopen', () => {
    const directory = mkdtempSync(join(tmpdir(), 'orca-agent-kind-migration-'))
    const filename = join(directory, 'history.db')
    let db = databaseThrough0022(filename)
    try {
      db.prepare(
        "INSERT INTO sessions (id, backend, created_at, updated_at, agent_kind) VALUES ('s1', 'claude', 1, 1, 'coding')"
      ).run()
      const messageId = db
        .prepare(
          "INSERT INTO messages (session_id, role, content, created_at, idx) VALUES ('s1', 'assistant', 'artifact migration needle', 2, 0)"
        )
        .run().lastInsertRowid
      db.prepare(
        "INSERT INTO artifact_files (id, relative_path, filename, kind, size_bytes, hash, created_at) VALUES ('file-1', 's1/report.html', 'report.html', 'html', 42, 'sha256-fixture', 3)"
      ).run()
      db.prepare(
        'INSERT INTO session_artifacts (id, session_id, artifact_file_id, message_id, tool_run_id, title, input_source, published_at, card_attached) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
      ).run('publication-1', 's1', 'file-1', messageId, 'tool-1', 'Report', 'tool', 4, 1)

      db.transaction(() => db.exec(readFileSync(migration0023Path, 'utf8')))()
      db.close()
      db = new Database(filename)
      db.pragma('foreign_keys = ON')

      expect(db.prepare("SELECT agent_kind FROM sessions WHERE id='s1'").pluck().get()).toBe('code')
      expect(
        db
          .prepare(
            'SELECT sa.id, sa.session_id, sa.artifact_file_id, sa.message_id, sa.tool_run_id, af.kind FROM session_artifacts sa JOIN artifact_files af ON af.id = sa.artifact_file_id'
          )
          .get()
      ).toEqual({
        id: 'publication-1',
        session_id: 's1',
        artifact_file_id: 'file-1',
        message_id: Number(messageId),
        tool_run_id: 'tool-1',
        kind: 'html'
      })
      expect(
        db
          .prepare("SELECT content FROM messages_fts WHERE messages_fts MATCH 'needle'")
          .pluck()
          .get()
      ).toBe('artifact migration needle')
      expect(db.pragma('foreign_key_check')).toEqual([])
      expect(db.pragma('integrity_check', { simple: true })).toBe('ok')
    } finally {
      if (db.open) db.close()
      rmSync(directory, { recursive: true, force: true })
    }
  })
})
