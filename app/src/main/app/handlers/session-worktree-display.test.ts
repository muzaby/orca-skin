// 0211 VP-08 — 재시작 뒤에도 표시 이름이 원본으로 복원되는가.
//
// **DB 를 닫고 새 `DbQueries` 로 다시 연다** — 같은 핸들에서 읽으면 메모리에 남은 값을 볼 뿐
// 재시작을 모형하지 못한다. 이 왕복이 없으면 "resume 하면 이름이 브랜치 slug 로 되돌아간다"
// 는 회귀가 조용히 통과한다.
//
// `session:load` 핸들러 전체가 아니라 그 안의 **조회 홉**을 본다: 핸들러는 `RouterContext`
// 전체를 요구해 electron 을 물지만, 이 pair 가 잠그는 것은 row → `LoadedSession.worktree`
// 매핑이다.

import Database from 'better-sqlite3'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => ({
  app: { getPath: () => '/tmp/orca-test-userdata', getName: () => 'orca' }
}))

import { applyMigrations } from '../../infra/db/migrate'
import { DbQueries } from '../../infra/db/queries'

const dirs: string[] = []
const handles: Database.Database[] = []

afterEach(async () => {
  for (const handle of handles.splice(0)) if (handle.open) handle.close()
  await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
})

function open(file: string): { db: Database.Database; q: DbQueries } {
  const db = new Database(file)
  handles.push(db)
  applyMigrations(db)
  return { db, q: new DbQueries(db) }
}

// `handlers/session.ts` 가 하는 매핑 그대로 — row 가 없으면 필드를 싣지 않는다.
function worktreeFor(
  q: DbQueries,
  sessionId: string
): { sourceCwd: string; repoRoot: string } | undefined {
  const row = q.getManagedWorktreeBySession(sessionId)
  return row ? { sourceCwd: row.source_cwd, repoRoot: row.repo_root } : undefined
}

describe('resume 후 표시 정본 복원 (VP-08)', () => {
  it('앱을 다시 켜도 source_cwd·repo_root 가 같은 값으로 돌아온다', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'orca-wtdisplay-'))
    dirs.push(dir)
    const file = join(dir, 'orca.db')

    const first = open(file)
    first.q.insertSession({
      id: 's1',
      backend: 'claude',
      title: null,
      projectId: null,
      createdAt: Date.now(),
      providerKey: 'claude:test',
      cwd: '/wt/orca-skin-1a2b3c4d/work-x',
      extraDirs: null
    })
    first.q.insertManagedWorktree({
      id: 'w1',
      repoRoot: '/repo/orca-skin',
      sourceCwd: '/repo/orca-skin/app',
      worktreeRoot: '/wt/orca-skin-1a2b3c4d/work-x',
      branch: 'work/x',
      baseOid: 'a'.repeat(40),
      createdAt: Date.now()
    })
    first.q.bindManagedWorktreeForCwd('s1', '/wt/orca-skin-1a2b3c4d/work-x')
    expect(worktreeFor(first.q, 's1')).toEqual({
      sourceCwd: '/repo/orca-skin/app',
      repoRoot: '/repo/orca-skin'
    })
    first.db.close()

    // 재시작 — 새 핸들, 새 DbQueries.
    const second = open(file)
    expect(worktreeFor(second.q, 's1')).toEqual({
      sourceCwd: '/repo/orca-skin/app',
      repoRoot: '/repo/orca-skin'
    })
  })

  it('managed row 가 없는 세션은 필드를 싣지 않는다 — 소비자가 cwd 파생으로 폴백한다', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'orca-wtdisplay-'))
    dirs.push(dir)
    const { q } = open(join(dir, 'orca.db'))
    q.insertSession({
      id: 's2',
      backend: 'claude',
      title: null,
      projectId: null,
      createdAt: Date.now(),
      providerKey: 'claude:test',
      cwd: '/repo/orca-skin',
      extraDirs: null
    })
    expect(worktreeFor(q, 's2')).toBeUndefined()
  })
})
