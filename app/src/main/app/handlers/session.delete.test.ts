// AC15 · VP-03 — `orca:session:delete` 는 **보존 이유를 결과 union 으로 돌려주고**, 보존일 때는
// runtime dispose 도 DB 삭제도 하지 않는다.
//
// service 층의 네 상태는 `features/worktrees/safe-delete.test.ts` 가 갖는다. 여기는 그 판정이
// **핸들러 경로에서 어떻게 쓰이는가** 다 — 순서가 뒤집히면 결과값이 `ok:false` 여도 세션은 이미
// 지워진 뒤고, 사용자는 "삭제 안 됨" 이라는 메시지와 사라진 세션을 동시에 본다.

import { describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { sourceFiles, stripCommentsAndStrings, toPosix } from '../../infra/source-scan'

const { handleMock, handlePlainMock } = vi.hoisted(() => ({
  handleMock: vi.fn(),
  handlePlainMock: vi.fn()
}))
vi.mock('../../infra/ipc/handle', () => ({ handle: handleMock, handlePlain: handlePlainMock }))

import { CHANNELS } from '../../../shared/ipc'
import type { RouterContext } from '../context'
import { registerSessionHandlers } from './session'

type Registered = { fallback: unknown; run: (req: { sessionId: string }) => Promise<unknown> }

function registerDelete(hooks: Parameters<typeof registerSessionHandlers>[1]): {
  reg: Registered
  order: string[]
  ctx: { deleted: string[] }
} {
  handleMock.mockClear()
  const order: string[] = []
  const deleted: string[] = []
  const ctx = {
    db: {
      deleteSession: (id: string) => {
        order.push('db.deleteSession')
        deleted.push(id)
      },
      listSessions: () => [],
      loadParts: () => [],
      getSessionById: () => null
    },
    settings: { getAll: () => ({ lastSessionId: null }), patch: vi.fn() },
    getCwd: () => '/w'
  } as unknown as RouterContext

  registerSessionHandlers(ctx, hooks)
  const call = handleMock.mock.calls.find((c) => c[0] === CHANNELS.sessionDelete)
  if (!call) throw new Error('sessionDelete 가 등록되지 않았다')
  return {
    reg: {
      fallback: (call[2] as { fallback: unknown }).fallback,
      run: call[3] as Registered['run']
    },
    order,
    ctx: { deleted }
  }
}

describe('orca:session:delete — 보존 이유를 union 으로 돌려준다 (AC15)', () => {
  it('worktree 가 보존되면 그 이유를 그대로 반환하고 dispose·DB 삭제를 하지 않는다', async () => {
    const order: string[] = []
    const { reg, ctx } = registerDelete({
      removeManagedWorktree: async () => {
        order.push('worktree.check')
        return {
          ok: false as const,
          reason: 'worktree-dirty' as const,
          message: 'Worktree에 커밋되지 않은 변경이 있어 세션을 삭제하지 않았습니다.'
        }
      },
      onSessionDisposed: () => order.push('dispose')
    })

    await expect(reg.run({ sessionId: 's1' })).resolves.toMatchObject({
      ok: false,
      reason: 'worktree-dirty'
    })
    expect(order).toEqual(['worktree.check'])
    expect(ctx.deleted).toEqual([])
  })

  it('안전하면 worktree 판정 → dispose → DB 삭제 순으로 진행한다', async () => {
    const order: string[] = []
    const { reg, ctx } = registerDelete({
      removeManagedWorktree: async () => {
        order.push('worktree.check')
        return { ok: true as const }
      },
      onSessionDisposed: () => order.push('dispose')
    })

    await expect(reg.run({ sessionId: 's1' })).resolves.toEqual({ ok: true })
    expect(order).toEqual(['worktree.check', 'dispose'])
    expect(ctx.deleted).toEqual(['s1'])
  })

  it('worktree hook 이 없는 배포에서도 기존 삭제 경로가 그대로 돈다', async () => {
    const { reg, ctx } = registerDelete({})

    await expect(reg.run({ sessionId: 's1' })).resolves.toEqual({ ok: true })
    expect(ctx.deleted).toEqual(['s1'])
  })

  it('무효 payload fallback 도 union 이라 renderer 가 `.ok` 를 읽을 수 있다', () => {
    const { reg } = registerDelete({})

    expect(reg.fallback).toMatchObject({ ok: false })
    expect(reg.fallback).toHaveProperty('message')
  })
})

// 위 케이스들은 hook 을 **주입해서** 핸들러 동작을 잠근다. 그 hook 을 실제로 채우는 것은
// 컴포지션 루트 한 줄이고, 그 줄이 없으면 핸들러는 `?? { ok: true }` 폴백을 타 managed
// worktree 검사 없이 세션을 지운다 — AC15 의 제품 실패인데 전 스위트가 초록이다(2635/2635 실측).
// hook 은 optional 이라 typecheck 도 부재를 잡지 못한다. 그래서 배선 자체를 여기서 본다.
describe('삭제 안전 검사 배선 (EP-07 · AC15)', () => {
  it('bootstrap 이 session 핸들러에 removeManagedWorktree 를 채운다', () => {
    const bootstrap = stripCommentsAndStrings(
      readFileSync(fileURLToPath(new URL('../bootstrap.ts', import.meta.url)), 'utf8')
    )
    // 이름만 같고 몸이 무동작이면 토큰 존재는 통과한다 — service 로 이어지는 형태까지 본다.
    expect(bootstrap).toMatch(
      /removeManagedWorktree\s*:\s*\(\s*\w+\s*\)\s*=>\s*\w+\.removeForSession\s*\(\s*\w+\s*\)/
    )
  })

  it('그 배선이 유일한 호출부다 — 종료·supervisor 경로는 worktree 를 지우지 않는다 (AC13)', () => {
    // AC13 의 음성 축이다. "종료 시 remove 0회" 는 현재 **호출부가 하나뿐이라** 성립하는데,
    // 그 사실을 지키는 장치가 없었다. 차집합으로 본다 — 총계가 아니라 삭제-경로 밖의 잔여다.
    const mainRoot = fileURLToPath(new URL('../..', import.meta.url))
    // 분류 단위는 파일이 아니라 **호출부**다 — 같은 파일 안의 두 번째 호출도 위반이다.
    const callers = sourceFiles(mainRoot).flatMap((file) =>
      [
        ...stripCommentsAndStrings(readFileSync(file, 'utf8')).matchAll(/\.removeForSession\s*\(/g)
      ].map(() => toPosix(file.slice(mainRoot.length)))
    )
    expect(callers).toEqual(['app/bootstrap.ts'])
  })
})
