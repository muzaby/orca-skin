import type Database from 'better-sqlite3'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { openFileDatabase } from './file-database'
import { warmFileSqlite } from './warm-file-sqlite'

const roots: string[] = []
beforeAll(warmFileSqlite)
afterEach(async () => {
  for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true })
})
async function path(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'orca-file-db-'))
  roots.push(root)
  return join(root, 'test.db')
}

describe('openFileDatabase', () => {
  // 이 세 값이 코어 DB(`infra/db/index.ts`)와 plugin 파일 DB 의 **공통 사본**이다. 0107 의
  // `synchronous = NORMAL` 이 여기서 빠지면 plugin DB 만 기본 FULL 로 돌아간다.
  it('enables WAL, NORMAL sync and foreign keys before running the caller schema initializer', async () => {
    const db = openFileDatabase(await path(), {
      initialize(connection) {
        expect(connection.pragma('journal_mode', { simple: true })).toBe('wal')
        expect(connection.pragma('synchronous', { simple: true })).toBe(1)
        expect(connection.pragma('foreign_keys', { simple: true })).toBe(1)
        connection.exec('CREATE TABLE owned_by_caller (id INTEGER PRIMARY KEY)')
      }
    })
    try {
      db.prepare('INSERT INTO owned_by_caller VALUES (?)').run(1)
      expect(db.prepare('SELECT id FROM owned_by_caller').all()).toEqual([{ id: 1 }])
    } finally {
      db.close()
    }
  })

  it('closes a failed initializer connection and permits a subsequent retry', async () => {
    const dbPath = await path()
    let failed: Database.Database | undefined
    expect(() =>
      openFileDatabase(dbPath, {
        initialize(db) {
          failed = db
          throw new Error('schema failure')
        }
      })
    ).toThrow('schema failure')
    try {
      expect(failed?.open).toBe(false)
    } finally {
      if (failed?.open) failed.close()
    }
    const retry = openFileDatabase(dbPath)
    expect(retry.open).toBe(true)
    retry.close()
  })
})
