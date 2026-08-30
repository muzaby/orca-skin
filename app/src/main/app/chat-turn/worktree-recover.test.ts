// AC12 · AC15 · AC16 · WP-07 · WP-17 — worktree 소실 폴백의 **두 DB 쓰기**를 실제 SQLite 로 본다.
//
// `prepare-worktree.test.ts` 는 그 위의 배선(갈래 선택·통지·respawn 전달)을 fake 로 잠근다.
// 여기서는 판정 자체와 영속을 본다 — 폴백이 메모리에서만 일어나면 다음 턴이 같은 죽은 경로를
// 다시 읽고, 재시작하면 화면도 그리로 돌아간다.
//
// **컴포지션 루트에 둔다** — 영속은 `features/worktrees`, resume 해석은 `app/chat-turn` 이라
// 이 계약은 두 레이어의 합성이다. feature 안에 두면 `boundaries/dependencies` 가 막는다
// (`worktree-bind.test.ts` 와 같은 이유).

import Database from 'better-sqlite3'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { applyMigrations } from '../../infra/db/migrate'
import { DbQueries } from '../../infra/db/queries'
import { warmFileSqlite } from '../../infra/db/warm-file-sqlite'
import { resolveTurnCwd } from './turn-context'
import { WorktreeService } from '../../features/worktrees/service'

// 프로세스 최초의 파일 sqlite 생성 비용을 케이스 예산 밖에서 치른다 — 근거는 헬퍼 헤더.
beforeAll(warmFileSqlite)

const dirs: string[] = []
const handles: Database.Database[] = []
afterEach(async () => {
  for (const handle of handles.splice(0)) if (handle.open) handle.close()
  await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
})

async function fixture(): Promise<{
  queries: DbQueries
  file: string
  source: string
  worktreeRoot: string
}> {
  const dir = await mkdtemp(join(tmpdir(), 'orca-recover-'))
  dirs.push(dir)
  // source 는 **실재하는** 디렉토리여야 한다 — 폴백은 되돌릴 곳이 있을 때만 성립한다.
  const source = dir
  const worktreeRoot = join(dir, 'gone', 'work-x')
  const file = join(dir, 'orca.db')
  const db = new Database(file)
  handles.push(db)
  db.pragma('foreign_keys = ON')
  applyMigrations(db)
  const queries = new DbQueries(db)
  queries.insertManagedWorktree({
    id: 'w1',
    repoRoot: source,
    sourceCwd: source,
    worktreeRoot,
    branch: 'work/x',
    baseOid: 'a'.repeat(40),
    createdAt: 1
  })
  queries.insertSession({
    id: 's1',
    backend: 'claude',
    title: null,
    projectId: null,
    createdAt: 2,
    cwd: worktreeRoot
  })
  return { queries, file, source, worktreeRoot }
}

describe('worktree 소실 폴백 (AC12 · AC15 · AC16)', () => {
  it('경로가 사라지면 session.cwd 를 source 로 옮기고 metadata 를 지운다 (AC15)', async () => {
    const { queries, source, worktreeRoot } = await fixture()
    const service = new WorktreeService(queries, '/unused')

    const result = await service.recoverMissingWorktree({
      sessionId: 's1',
      executionCwd: worktreeRoot,
      now: 99
    })

    expect(result).toEqual({
      kind: 'recovered',
      executionCwd: source,
      lostWorktreeRoot: worktreeRoot
    })
    expect(queries.getSessionById('s1')?.cwd).toBe(source)
    // metadata 를 남기면 다음 턴이 이미 없는 worktree 를 다시 폴백 대상으로 본다.
    expect(queries.getManagedWorktreeBySession('s1')).toBeNull()
  })

  it('재시작해도 source cwd 로 resume 한다 — 폴백이 1회성이 아니다 (AC16)', async () => {
    const { queries, file, source, worktreeRoot } = await fixture()
    await new WorktreeService(queries, '/unused').recoverMissingWorktree({
      sessionId: 's1',
      executionCwd: worktreeRoot
    })

    const reopened = new Database(file)
    handles.push(reopened)
    const fresh = new DbQueries(reopened)
    const meta = fresh.getSessionById('s1')
    expect(resolveTurnCwd({ sessionId: 's1', projectId: null }, meta, () => '/fallback')).toBe(
      source
    )
  })

  it('경로가 살아 있으면 아무것도 쓰지 않는다 — 정상 resume 이 폴백으로 오염되지 않는다 (AC19)', async () => {
    const { queries, source } = await fixture()

    const result = await new WorktreeService(queries, '/unused').recoverMissingWorktree({
      sessionId: 's1',
      executionCwd: source
    })

    expect(result).toEqual({ kind: 'none' })
    expect(queries.getManagedWorktreeBySession('s1')?.id).toBe('w1')
  })

  it('원본마저 없으면 unrecoverable 이고 DB 를 건드리지 않는다', async () => {
    const { queries, worktreeRoot } = await fixture()
    queries.updateSessionCwd('s1', worktreeRoot, 3)
    const service = new WorktreeService(queries, '/unused')
    // source 를 지운 상태를 만든다 — row 의 source_cwd 를 존재하지 않는 경로로 바꾼다.
    const db = handles[handles.length - 1]
    db.prepare('UPDATE managed_worktrees SET source_cwd = ? WHERE id = ?').run(
      join(worktreeRoot, 'nowhere'),
      'w1'
    )

    const result = await service.recoverMissingWorktree({
      sessionId: 's1',
      executionCwd: worktreeRoot
    })

    expect(result.kind).toBe('unrecoverable')
    expect(queries.getManagedWorktreeBySession('s1')?.id).toBe('w1')
    expect(queries.getSessionById('s1')?.cwd).toBe(worktreeRoot)
  })
})
