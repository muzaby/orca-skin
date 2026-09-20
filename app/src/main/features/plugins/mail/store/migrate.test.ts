import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { openFileDatabase } from '../../../../infra/db/file-database'
import { warmFileSqlite } from '../../../../infra/db/warm-file-sqlite'
import { MAIL_MIGRATION_NAMES, applyMailMigrations } from './migrate'

const roots: string[] = []
beforeAll(warmFileSqlite)
afterEach(async () => {
  for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true })
})

async function dbPath(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'orca-mail-migrate-'))
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
})
