import { expect, it } from 'vitest'
import Database from 'better-sqlite3'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { applyMigrations } from './migrate'
import { DbQueries } from './queries'

it('persists Work across reopen, defaults callers to Code, and preserves birth on conflict', () => {
  const root = mkdtempSync(join(tmpdir(), 'orca-agent-kind-'))
  let db: Database.Database | undefined
  try {
    const path = join(root, 'fixture.db')
    db = new Database(path)
    applyMigrations(db)
    let queries = new DbQueries(db)
    queries.insertProject({ id: 'p', name: 'project', instructions: '', createdAt: 1 })
    queries.insertSession({
      id: 'w',
      backend: 'claude',
      title: 'work',
      projectId: 'p',
      createdAt: 1,
      agentKind: 'work'
    })
    queries.insertSession({
      id: 'c',
      backend: 'claude',
      title: 'code',
      projectId: null,
      createdAt: 2
    })
    queries.insertSession({
      id: 'w',
      backend: 'claude',
      title: 'overwrite',
      projectId: null,
      createdAt: 3,
      agentKind: 'code'
    })
    db.close()
    db = new Database(path)
    queries = new DbQueries(db)
    expect(queries.getSessionById('w')?.agent_kind).toBe('work')
    expect(queries.getSessionById('c')?.agent_kind).toBe('code')
    expect(queries.listSessions().map((row) => row.agent_kind)).toEqual(['code', 'work'])
    expect(queries.listSessionsByProject('p').map((row) => row.agent_kind)).toEqual(['work'])
    expect(() =>
      db!.prepare("UPDATE sessions SET agent_kind='invalid' WHERE id='w'").run()
    ).toThrow()
  } finally {
    db?.close()
    rmSync(root, { recursive: true, force: true })
  }
})
