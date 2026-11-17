// 세션 핸들러의 실행 쪽 훅 (0324 AC43 · AC19′ · EP-21). 세션 삭제는 그 세션의 런타임을 먼저 폐기한
// 뒤 DB 를 바꾸고, 에이전트 호스트가 없으면 폐기 없이 진행한다. 활동·바쁨은 띄우지 않고 쉬는 상태로
// 보고, 갱신의 원본 읽기만 에이전트 호스트를 확보한다.
import { describe, expect, it, vi } from 'vitest'
import { CHANNELS, type ChatActivitySnapshot } from '../../../shared/ipc'
import type { NativeSyncDependencies } from '../../features/history/native-sync'
import type { DbQueries } from '../../infra/db'
import { PEER_CLOSED_ERROR } from '../../infra/ipc/peer-link'
import type { RouterContext } from '../context'

const handlers = vi.hoisted(
  () => new Map<string, (request: { sessionId: string }) => Promise<unknown>>()
)
vi.mock('../../infra/ipc/handle', () => ({
  handle: (
    channel: string,
    _schema: unknown,
    _options: unknown,
    run: (req: { sessionId: string }) => Promise<unknown>
  ) => handlers.set(channel, run),
  handlePlain: vi.fn(),
  on: vi.fn()
}))
const refreshed = vi.hoisted(() => ({ deps: null as NativeSyncDependencies | null }))
vi.mock('../../features/history/native-sync', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  refreshNativeHistory: vi.fn(async (_sessionId: string, deps: NativeSyncDependencies) => {
    refreshed.deps = deps
    return { status: 'unchanged' }
  })
}))

import { registerSessionHandlers } from '../handlers/session'
import { createSessionHooks, IDLE_ACTIVITY } from './session-hooks'

type Link = Parameters<typeof createSessionHooks>[0]['link']

function fakeLink(
  connected: boolean,
  order: string[]
): Link & {
  request: ReturnType<typeof vi.fn>
  requestEnsured: ReturnType<typeof vi.fn>
} {
  const activity = { busy: true, phase: 'streaming' } as unknown as ChatActivitySnapshot
  return {
    request: vi.fn(async (op: string) => {
      order.push(`${op}:${connected ? 'sent' : 'closed'}`)
      if (!connected) throw new Error(PEER_CLOSED_ERROR)
      if (op === 'sessionActivity') return activity
      if (op === 'sessionBusy') return true
      return undefined
    }),
    requestEnsured: vi.fn(async (op: string) => {
      order.push(`${op}:ensured`)
      return { status: 'snapshot-from-agent' }
    })
  } as never
}

function register(link: Link, order: string[]): { hideSession: ReturnType<typeof vi.fn> } {
  const db = { hideSession: vi.fn(() => order.push('hide')) }
  registerSessionHandlers(
    {
      db,
      getCwd: vi.fn(),
      settings: { getAll: () => ({ lastSessionId: null }), patch: vi.fn() }
    } as unknown as RouterContext,
    createSessionHooks({
      link,
      db: db as unknown as DbQueries,
      forgetSession: (sessionId) => order.push(`forget:${sessionId}`)
    })
  )
  return db
}

describe('세션 삭제 — 런타임 폐기 → DB 변경 (AC43)', () => {
  it('에이전트 호스트가 있으면 저장 쪽 상태를 잊고 런타임을 폐기한 뒤에 숨긴다', async () => {
    const order: string[] = []
    const link = fakeLink(true, order)
    const db = register(link, order)
    await expect(handlers.get(CHANNELS.sessionDelete)!({ sessionId: 's1' })).resolves.toEqual({
      ok: true
    })
    expect(order).toEqual(['forget:s1', 'discardSession:sent', 'hide'])
    expect(link.request).toHaveBeenCalledWith('discardSession', 's1')
    expect(db.hideSession).toHaveBeenCalledWith('s1')
    expect(link.requestEnsured).not.toHaveBeenCalled()
  })

  it('에이전트 호스트가 없으면 폐기 없이 숨기고, 띄워 달라고 하지 않는다', async () => {
    const order: string[] = []
    const link = fakeLink(false, order)
    register(link, order)
    await expect(handlers.get(CHANNELS.sessionDelete)!({ sessionId: 's2' })).resolves.toEqual({
      ok: true
    })
    expect(order).toEqual(['forget:s2', 'discardSession:closed', 'hide'])
    expect(link.requestEnsured).not.toHaveBeenCalled()
  })
})

describe('활동·바쁨은 띄우지 않는다 (AC19′ · EP-21)', () => {
  it('연결돼 있으면 에이전트 호스트의 답을 그대로 준다', async () => {
    const order: string[] = []
    const hooks = createSessionHooks({
      link: fakeLink(true, order),
      db: {} as DbQueries,
      forgetSession: vi.fn()
    })
    await expect(hooks.getActivity('s')).resolves.toMatchObject({ busy: true, phase: 'streaming' })
    await expect(hooks.isSessionBusy('s')).resolves.toBe(true)
    expect(order).toEqual(['sessionActivity:sent', 'sessionBusy:sent'])
  })

  it('연결이 없으면 쉬는 상태로 답하고 확보를 부탁하지 않는다', async () => {
    const order: string[] = []
    const link = fakeLink(false, order)
    const hooks = createSessionHooks({ link, db: {} as DbQueries, forgetSession: vi.fn() })
    await expect(hooks.getActivity('s')).resolves.toBe(IDLE_ACTIVITY)
    await expect(hooks.isSessionBusy('s')).resolves.toBe(false)
    expect(link.requestEnsured).not.toHaveBeenCalled()
  })
})

describe('갱신의 원본 읽기만 확보한다 (EP-21)', () => {
  it('원본 읽기는 requestEnsured, 바쁨 판정은 request 로 그 세션을 묻는다', async () => {
    const order: string[] = []
    const link = fakeLink(true, order)
    const db = { marker: 'db' } as unknown as DbQueries
    const hooks = createSessionHooks({ link, db, forgetSession: vi.fn() })
    await hooks.refreshHistory('s3')
    const deps = refreshed.deps!
    expect(deps.db).toBe(db)
    await expect(deps.read()).resolves.toEqual({ status: 'snapshot-from-agent' })
    await expect(deps.isBusy()).resolves.toBe(true)
    expect(link.requestEnsured).toHaveBeenCalledWith('readNativeHistory', 's3')
    expect(link.request).toHaveBeenCalledWith('sessionBusy', 's3')
    expect(order).toEqual(['readNativeHistory:ensured', 'sessionBusy:sent'])
  })

  it('에이전트 호스트가 읽을 원본이 없다고 답하면 바뀐 것 없음으로 본다', async () => {
    const order: string[] = []
    const link = fakeLink(true, order)
    link.requestEnsured.mockResolvedValueOnce(null)
    const hooks = createSessionHooks({ link, db: {} as DbQueries, forgetSession: vi.fn() })
    await hooks.refreshHistory('s4')
    await expect(refreshed.deps!.read()).resolves.toEqual({ status: 'unchanged' })
  })
})
