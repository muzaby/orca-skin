import { afterEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import type { AuthChange, LoginFreeConnect, LoginFreeDefinition } from '../../contracts/auth'
import type { HostHarnessPort } from '../../adapters/common/harness-config'
import {
  CONNECT_FAILED_MESSAGE,
  CONNECT_HOST_MISSING_MESSAGE,
  CONNECT_TIMEOUT_MESSAGE,
  LOGIN_FREE_CONNECT_TIMEOUT_MS,
  createLoginFreeConnections,
  type LoginFreeConnections
} from './login-free-connection'

const host: HostHarnessPort = {
  installed: async () => ({ installed: true }),
  listModels: async () => []
}

function setup(run: LoginFreeConnect['run']): {
  connections: LoginFreeConnections
  changes: AuthChange[]
  summary: () => unknown[]
} {
  const changes: AuthChange[] = []
  const definition: LoginFreeDefinition = {
    id: 'opencode-llm',
    label: 'OpenCode',
    connect: { run }
  }
  const connections = createLoginFreeConnections({
    definitions: [definition, { id: 'plain', label: 'Plain' }],
    host,
    notify: (change) => changes.push(change)
  })
  const summary = (): unknown[] =>
    changes.map((change) =>
      change.kind === 'snapshot'
        ? [change.cause, change.credentialChanged, change.snapshot.connection?.state]
        : change.kind
    )
  return { connections, changes, summary }
}

afterEach(() => {
  vi.useRealTimers()
})

describe('createLoginFreeConnections (0291 MD-01)', () => {
  it('idle → checking → connected 로 전이하고 결과를 보관한다', async () => {
    const result = [{ id: 'corp/a' }]
    const run = vi.fn<LoginFreeConnect['run']>(async () => result)
    const { connections, summary } = setup(run)
    expect(connections.has('opencode-llm')).toBe(true)
    expect(connections.has('plain')).toBe(false)
    expect(connections.snapshot('opencode-llm')).toEqual({
      authId: 'opencode-llm',
      status: 'none',
      verified: false,
      credentialRevision: 0,
      connection: { state: 'idle' }
    })
    expect(await connections.connect('opencode-llm')).toEqual({ state: 'connected' })
    expect(summary()).toEqual([
      ['connection-started', false, 'checking'],
      ['connection-succeeded', true, 'connected']
    ])
    expect(connections.snapshot('opencode-llm')).toEqual({
      authId: 'opencode-llm',
      status: 'valid',
      verified: true,
      credentialRevision: 1,
      connection: { state: 'connected' }
    })
    expect(connections.value('opencode-llm')).toBe(result)
    expect(run).toHaveBeenCalledTimes(1)
    expect(Object.keys(run.mock.calls[0]![0]).sort()).toEqual(['host', 'signal'])
    expect(run.mock.calls[0]![0].host).toBe(host)
  })

  it('undefined 결과는 null 로 보관한다', async () => {
    const { connections } = setup(async () => undefined)
    await connections.connect('opencode-llm')
    expect(connections.value('opencode-llm')).toBeNull()
  })

  it('같은 결과의 재연결은 revision 을 올리지 않고 verified 로 알린다', async () => {
    let value: unknown = { b: 1, a: [1, 2] }
    const { connections, summary, changes } = setup(async () => value)
    await connections.connect('opencode-llm')
    changes.length = 0
    value = { a: [1, 2], b: 1 }
    const pending = connections.connect('opencode-llm')
    // 확인 중에도 이전 연결은 유효하다.
    expect(connections.snapshot('opencode-llm')).toMatchObject({
      status: 'valid',
      verified: true,
      credentialRevision: 1,
      connection: { state: 'checking' }
    })
    await pending
    expect(summary()).toEqual([
      ['connection-started', false, 'checking'],
      ['verified', false, 'connected']
    ])
    expect(connections.snapshot('opencode-llm').credentialRevision).toBe(1)
  })

  it('다른 결과의 재연결은 revision+1 이고 결과를 교체한다', async () => {
    let value: unknown = ['a']
    const { connections, summary, changes } = setup(async () => value)
    await connections.connect('opencode-llm')
    changes.length = 0
    value = ['a', 'b']
    await connections.connect('opencode-llm')
    expect(summary()).toEqual([
      ['connection-started', false, 'checking'],
      ['connection-succeeded', true, 'connected']
    ])
    expect(connections.snapshot('opencode-llm').credentialRevision).toBe(2)
    expect(connections.value('opencode-llm')).toEqual(['a', 'b'])
  })

  it('실패는 메시지를 남기고 이전 connected 일 때만 credentialChanged 다', async () => {
    let fail = false
    const { connections, summary, changes } = setup(async () => {
      if (fail) throw new Error('  OpenCode가 설치되어 있지 않습니다.  ')
      return ['x']
    })
    // idle 에서 실패 — 무효화할 것이 없다.
    fail = true
    expect(await connections.connect('opencode-llm')).toEqual({
      state: 'failed',
      message: 'OpenCode가 설치되어 있지 않습니다.'
    })
    expect(summary()).toEqual([
      ['connection-started', false, 'checking'],
      ['connection-failed', false, 'failed']
    ])
    expect(connections.snapshot('opencode-llm')).toMatchObject({
      status: 'none',
      verified: false,
      credentialRevision: 0
    })
    fail = false
    await connections.connect('opencode-llm')
    changes.length = 0
    fail = true
    await connections.connect('opencode-llm')
    expect(summary()).toEqual([
      ['connection-started', false, 'checking'],
      ['connection-failed', true, 'failed']
    ])
    expect(connections.snapshot('opencode-llm')).toMatchObject({
      status: 'none',
      verified: false,
      credentialRevision: 2
    })
    expect(connections.value('opencode-llm')).toBeUndefined()
  })

  it('빈 메시지는 기본 문구, 긴 메시지는 500자로 자른다', async () => {
    let error: unknown = new Error('')
    const { connections } = setup(async () => {
      throw error
    })
    expect((await connections.connect('opencode-llm')).message).toBe(CONNECT_FAILED_MESSAGE)
    error = new Error('x'.repeat(800))
    expect((await connections.connect('opencode-llm')).message).toHaveLength(500)
  })

  it.each([
    [
      'cycle',
      (): unknown => {
        const value: Record<string, unknown> = {}
        value.self = value
        return value
      }
    ],
    ['BigInt', (): unknown => ({ n: BigInt(1) })]
  ])('직렬화할 수 없는 결과(%s)는 실패다', async (_name, make) => {
    const { connections } = setup(async () => make())
    expect((await connections.connect('opencode-llm')).state).toBe('failed')
    expect(connections.value('opencode-llm')).toBeUndefined()
  })

  it('동시 두 번 호출은 run 을 한 번만 실행한다', async () => {
    let release!: (value: unknown) => void
    const run = vi.fn(() => new Promise<unknown>((resolve) => (release = resolve)))
    const { connections } = setup(run)
    const a = connections.connect('opencode-llm')
    const b = connections.connect('opencode-llm')
    release(['m'])
    expect(await a).toEqual(await b)
    expect(run).toHaveBeenCalledTimes(1)
  })

  it('signal 을 무시한 run 도 시간 초과로 실패하고 그 signal 은 abort 된다', async () => {
    vi.useFakeTimers()
    let seen: AbortSignal | undefined
    const { connections } = setup(({ signal }) => {
      seen = signal
      return new Promise(() => undefined)
    })
    const pending = connections.connect('opencode-llm')
    await vi.advanceTimersByTimeAsync(LOGIN_FREE_CONNECT_TIMEOUT_MS)
    expect(await pending).toEqual({ state: 'failed', message: CONNECT_TIMEOUT_MESSAGE })
    expect(seen?.aborted).toBe(true)
  })

  it('호스트 능력이 없으면 실패한다(fail-closed)', async () => {
    const run = vi.fn(async () => [])
    const connections = createLoginFreeConnections({
      definitions: [{ id: 'x', label: 'X', connect: { run } }],
      notify: () => undefined
    })
    expect(await connections.connect('x')).toEqual({
      state: 'failed',
      message: CONNECT_HOST_MISSING_MESSAGE
    })
    expect(run).not.toHaveBeenCalled()
  })

  it('connectAll 은 선언 대상 전부를 병렬로 확인하고 실패를 흡수한다', async () => {
    const order: string[] = []
    const connections = createLoginFreeConnections({
      definitions: [
        {
          id: 'a',
          label: 'A',
          connect: {
            run: async () => {
              order.push('a')
              throw new Error('boom')
            }
          }
        },
        { id: 'b', label: 'B', connect: { run: async () => void order.push('b') } },
        { id: 'plain', label: 'Plain' }
      ],
      host,
      notify: () => undefined
    })
    await expect(connections.connectAll()).resolves.toBeUndefined()
    expect(order.sort()).toEqual(['a', 'b'])
    expect(connections.snapshot('a').connection?.state).toBe('failed')
    expect(connections.snapshot('b').connection?.state).toBe('connected')
  })

  it('connectionValue는 connected일 때만 결과를 준다', async () => {
    let release!: (value: unknown) => void
    let mode: 'ok' | 'hang' = 'ok'
    const { connections } = setup(() =>
      mode === 'ok' ? Promise.resolve(['m']) : new Promise((resolve) => (release = resolve))
    )
    expect(connections.value('opencode-llm')).toBeUndefined()
    await connections.connect('opencode-llm')
    expect(connections.value('opencode-llm')).toEqual(['m'])
    mode = 'hang'
    const pending = connections.connect('opencode-llm')
    expect(connections.value('opencode-llm')).toBeUndefined()
    release(['m'])
    await pending
    expect(connections.value('opencode-llm')).toEqual(['m'])
    expect(connections.value('plain')).toBeUndefined()
  })

  it('저장 포트를 갖지 않는다 — 연결 상태는 메모리뿐이다 (D-008)', () => {
    const source = readFileSync(new URL('./login-free-connection.ts', import.meta.url), 'utf8')
    expect(source).not.toMatch(/electron-store|createRecordPersistence|writeFile|node:fs/)
  })
})
