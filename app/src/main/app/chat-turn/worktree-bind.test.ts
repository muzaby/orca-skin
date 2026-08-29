// AC12 · AC13 — VP-06 (nullable row → bind → reopen) · VP-08 (양성 resume) · EP-06 세 번째 지점.
//
// `infra/db/managed-worktrees.test.ts` 는 `DbQueries` 를 직접 불러 bind 를 본다. 그것은 두 지점
// 중 하나다 — 실제로 그 쿼리를 부르는 것은 **`HistoryWriter` 가 `session.updated` 를 영속할 때**이고,
// 그 지점이 끊기면 row 는 영원히 unbound 로 남는다. 여기서는 writer 를 지나 bind 되는지, 재시작
// (같은 파일을 새 `DbQueries` 로 다시 열기)해도 같은 executionCwd 로 resume 되는지 본다.
//
// **컴포지션 루트에 둔다** — 영속은 `features/history`, resume 은 `app/chat-turn` 이라 이 계약은
// 두 레이어의 합성이다. feature 안에 두면 `boundaries/dependencies` 가 features→app 을 막는다.

import Database from 'better-sqlite3'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'

// `HistoryWriter` → `infra/log` 가 `electron.app` 을 문다. 저장소에 이미 있는 패턴으로 끊는다
// (`app/handlers/misc-split.test.ts` 와 같은 형태) — 로그는 이 계약의 대상이 아니다.
vi.mock('electron', () => ({
  app: { getPath: () => '/tmp/orca-test-userdata', getName: () => 'orca' }
}))
import { applyMigrations } from '../../infra/db/migrate'
import { DbQueries } from '../../infra/db/queries'
import { resolveTurnCwd } from './turn-context'
import { HistoryWriter } from '../../features/history/writer'
import type { TurnContext } from '../../contracts/turn'

const dirs: string[] = []
// 열어 둔 sqlite 핸들은 **지우기 전에** 전부 닫는다. Windows 는 열린 파일을 unlink 하지 못해
// `rm()` 이 EBUSY 로 죽는다(CI windows 러너 실측). 테스트마다 손으로 닫으면 단언이 먼저
// throw 할 때 그 close 를 건너뛰므로, 연 자리에서 등록하고 여기서 한 번에 닫는다.
const handles: Database.Database[] = []
afterEach(async () => {
  for (const handle of handles.splice(0)) if (handle.open) handle.close()
  await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
})

const MANAGED = '/managed/repoid/wtid'
const EXECUTION = `${MANAGED}/packages/web`

function turnFor(cwd: string): TurnContext {
  return {
    dbSessionId: null,
    isNewSession: true,
    pendingUserText: 'work',
    pendingAttachmentViews: [],
    titleAdapter: { id: 'claude' },
    providerKey: 'claude:test',
    cwd,
    extraDirs: [],
    initialTitle: undefined
  } as unknown as TurnContext
}

async function openDb(): Promise<{ file: string; db: Database.Database; q: DbQueries }> {
  const dir = await mkdtemp(join(tmpdir(), 'orca-bind-'))
  dirs.push(dir)
  const file = join(dir, 'orca.db')
  const db = openHandle(file)
  applyMigrations(db)
  return { file, db, q: new DbQueries(db) }
}

// 모든 핸들이 이 한 곳을 지난다 — 등록되지 않은 핸들이 생기면 afterEach 가 못 닫는다.
// 매번 **새 핸들**이다: 재시작 케이스는 닫힌 파일을 다시 여는 것이 계약이라 재사용하면 안 된다.
function openHandle(file: string): Database.Database {
  const db = new Database(file)
  db.pragma('foreign_keys = ON')
  handles.push(db)
  return db
}

describe('HistoryWriter → managed worktree bind → resume (AC12 · AC13)', () => {
  it('session.updated 영속이 unbound row 를 그 세션에 묶는다 — writer 층이 그 지점이다', async () => {
    const { q } = await openDb()
    q.insertManagedWorktree({
      id: 'w1',
      repoRoot: '/repo',
      sourceCwd: '/repo/packages/web',
      worktreeRoot: MANAGED,
      branch: 'work/x',
      baseOid: 'a'.repeat(40),
      createdAt: 1
    })
    expect(q.getManagedWorktreeBySession('s1')).toBeNull()

    const writer = new HistoryWriter(q, { emit: vi.fn() } as never)
    writer.persist(turnFor(EXECUTION), { type: 'session.updated', sessionId: 's1' } as never)

    expect(q.getManagedWorktreeBySession('s1')).toMatchObject({ id: 'w1', session_id: 's1' })
  })

  it('재시작해도 같은 executionCwd 로 resume 한다 — 저장된 값이 다음 턴의 cwd 다', async () => {
    const { file, db, q } = await openDb()
    q.insertManagedWorktree({
      id: 'w1',
      repoRoot: '/repo',
      sourceCwd: '/repo/packages/web',
      worktreeRoot: MANAGED,
      branch: 'work/x',
      baseOid: 'a'.repeat(40),
      createdAt: 1
    })
    new HistoryWriter(q, { emit: vi.fn() } as never).persist(turnFor(EXECUTION), {
      type: 'session.updated',
      sessionId: 's1'
    } as never)
    db.close()

    // 앱 재시작 — 같은 파일을 새 핸들로 연다.
    const reopened = openHandle(file)
    const q2 = new DbQueries(reopened)
    const meta = q2.getSessionById('s1')

    expect(meta?.cwd).toBe(EXECUTION)
    expect(q2.getManagedWorktreeBySession('s1')).toMatchObject({ worktree_root: MANAGED })
    // resume 턴의 cwd 는 payload 가 아니라 저장된 세션 메타에서 나온다.
    expect(
      resolveTurnCwd(
        { sessionId: 's1', projectId: null, cwd: '/repo/packages/web' },
        meta as never,
        () => '/fallback'
      )
    ).toBe(EXECUTION)
  })

  it('source cwd 로 시작한 세션은 어떤 row 에도 묶이지 않는다 — 조상만 묶는다', async () => {
    const { q } = await openDb()
    q.insertManagedWorktree({
      id: 'w1',
      repoRoot: '/repo',
      sourceCwd: '/repo/packages/web',
      worktreeRoot: MANAGED,
      branch: 'work/x',
      baseOid: 'a'.repeat(40),
      createdAt: 1
    })

    new HistoryWriter(q, { emit: vi.fn() } as never).persist(turnFor('/repo/packages/web'), {
      type: 'session.updated',
      sessionId: 's1'
    } as never)

    expect(q.getManagedWorktreeBySession('s1')).toBeNull()
  })
})
