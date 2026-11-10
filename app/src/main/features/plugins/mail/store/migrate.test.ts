import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { openFileDatabase } from '../../../../infra/db/file-database'
import { warmFileSqlite } from '../../../../infra/db/warm-file-sqlite'
import {
  MAIL_MIGRATIONS,
  MAIL_MIGRATION_NAMES,
  applyMailMigrations,
  applyMigrationList
} from './migrate'

const roots: string[] = []
beforeAll(warmFileSqlite)
afterEach(async () => {
  for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true })
})

async function dbPath(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'orcinus-orca-mail-migrate-'))
  roots.push(root)
  return join(root, 'mail.db')
}

// `createMailStore` 는 도구 작업마다 이 DB 를 새로 연다(D-053). 적용 기록이 남지 않으면 두 번째
// 호출이 마이그레이션을 다시 실행한다 — 지금 SQL 이 전부 `IF NOT EXISTS` 라 증상이 가려질 뿐,
// 멱등하지 않은 `0002_mail` 이 들어오는 순간 데이터 손상이 된다. 기록 자체를 단언한다.
describe('applyMailMigrations', () => {
  it('records every applied migration in the shared _migrations meta', async () => {
    const db = openFileDatabase(await dbPath(), { initialize: applyMailMigrations })
    try {
      const applied = (
        db.prepare('SELECT name FROM _migrations ORDER BY name').all() as {
          name: string
        }[]
      ).map((row) => row.name)
      expect(applied).toEqual([...MAIL_MIGRATION_NAMES])
    } finally {
      db.close()
    }
  })

  it('applies exactly once across reopens of the same file', async () => {
    const path = await dbPath()
    const first = openFileDatabase(path, { initialize: applyMailMigrations })
    const stamped = first.prepare('SELECT name, applied_at FROM _migrations ORDER BY name').all()
    first.close()

    const second = openFileDatabase(path, { initialize: applyMailMigrations })
    try {
      expect(
        second.prepare('SELECT name, applied_at FROM _migrations ORDER BY name').all()
      ).toEqual(stamped)
    } finally {
      second.close()
    }
  })

  // 0302 AC8 — 0001 만 적용된 기존 캐시가 0002 로 정확히 채워진다.
  it('backfills body_source on an existing 0001 cache and restricts its values', async () => {
    const path = await dbPath()
    const legacy = openFileDatabase(path, {
      initialize: (db) =>
        applyMigrationList(
          db,
          MAIL_MIGRATIONS.filter((migration) => migration.name === '0001_mail')
        )
    })
    legacy.exec(`INSERT INTO account VALUES ('a', 'mail', 'h', 110, 0, 0)`)
    legacy.exec(
      `INSERT INTO mail (account_id, uidl, first_seen_at, from_addr, to_addrs, cc_addrs, subject, body_text)
       VALUES ('a', 'with-body', 0, '', '', '', 's', 'legacy text'), ('a', 'empty-body', 0, '', '', '', 's', '')`
    )
    legacy.close()

    const db = openFileDatabase(path, { initialize: applyMailMigrations })
    try {
      expect(
        db.prepare('SELECT uidl, body_source AS source FROM mail ORDER BY uidl').all()
      ).toEqual([
        { uidl: 'empty-body', source: 'none' },
        { uidl: 'with-body', source: 'plain' }
      ])
      expect(
        db.prepare(`SELECT rowid FROM mail_fts WHERE mail_fts MATCH 'legacy'`).all()
      ).toHaveLength(1)
      for (const source of ['plain', 'html', 'attachment', 'none'])
        db.prepare(`UPDATE mail SET body_source=? WHERE uidl='empty-body'`).run(source)
      expect(() =>
        db.prepare(`UPDATE mail SET body_source='x' WHERE uidl='empty-body'`).run()
      ).toThrow(/CHECK constraint failed/)
    } finally {
      db.close()
    }
  })

  // 0302 AC9 — 실패한 마이그레이션은 스키마 변경도 기록도 남기지 않는다.
  it('rolls back a failing migration together with its record', async () => {
    const db = openFileDatabase(await dbPath(), { initialize: applyMailMigrations })
    try {
      expect(() =>
        applyMigrationList(db, [
          {
            name: '9999_fail',
            sql: 'ALTER TABLE mail ADD COLUMN probe TEXT; SELECT * FROM missing_table;'
          }
        ])
      ).toThrow(/missing_table/)
      const columns = (db.prepare('PRAGMA table_info(mail)').all() as { name: string }[]).map(
        (column) => column.name
      )
      expect(columns).toContain('body_source')
      expect(columns).not.toContain('probe')
      expect(db.prepare(`SELECT name FROM _migrations WHERE name='9999_fail'`).all()).toEqual([])
    } finally {
      db.close()
    }
  })
})
