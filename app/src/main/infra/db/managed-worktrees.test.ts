import Database from 'better-sqlite3'
import { describe, expect, it } from 'vitest'
import { applyMigrations } from './migrate'
import { DbQueries } from './queries'

describe('managed_worktrees persistence', () => {
  it('nullable metadata를 execution cwd로 session에 bind하고 삭제 뒤에도 row를 보존한다', () => {
    const db = new Database(':memory:')
    db.pragma('foreign_keys = ON')
    applyMigrations(db)
    const queries = new DbQueries(db)
    queries.insertManagedWorktree({
      id: 'w1',
      repoRoot: '/repo',
      sourceCwd: '/repo/packages/web',
      worktreeRoot: '/managed/w1',
      branch: 'work/test',
      baseOid: 'a'.repeat(40),
      createdAt: 1
    })
    queries.insertSession({
      id: 's1',
      backend: 'claude',
      title: null,
      projectId: null,
      createdAt: 2,
      cwd: '/managed/w1/packages/web'
    })
    expect(queries.getManagedWorktreeBySession('s1')?.id).toBe('w1')
    queries.deleteSession('s1')
    expect(
      (
        db.prepare('SELECT session_id FROM managed_worktrees WHERE id = ?').get('w1') as {
          session_id: string | null
        }
      ).session_id
    ).toBeNull()
    db.close()
  })
})
