// 런타임 도구·관리형 MCP 사본의 왕복 (0324 D-038 · F2 — 구현 보고 G-A·G-D).
import { describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import type { ManagedMcpSnapshot } from '../adapters/common/managed-mcp'
import type { RuntimeToolServer } from '../adapters/common/runtime-tools'
import {
  createManagedMcpLeaseHost,
  createRemoteManagedMcp,
  createRemoteRuntimeTools,
  createToolCallHost,
  referencedVariables,
  serializeManagedMcp,
  serializeRuntimeTools,
  type RemoteToolCall,
  type ToolCallPort
} from './remote-tools'

function server(id: string, handler = vi.fn()): RuntimeToolServer {
  return {
    descriptor: { id, connectorId: `${id}-c`, tools: [{ name: 'publish', description: '게시' }] },
    implementations: [
      {
        name: 'publish',
        inputSchema: { path: z.string(), pinned: z.boolean().optional() },
        handler: async (input, context) => {
          handler(input, context)
          return { content: [{ type: 'text', text: `ok:${String(input.path)}` }] }
        }
      }
    ]
  }
}

// 대리 → 실제 호출 처리를 메모리로 잇는다 — 요청은 구조화 복제를 지난다.
function wire(
  host: ReturnType<typeof createToolCallHost>
): ToolCallPort & { calls: RemoteToolCall[] } {
  const calls: RemoteToolCall[] = []
  return {
    calls,
    call: async (request) => {
      calls.push(request)
      return host.call(structuredClone(request))
    },
    cancel: (callId) => host.cancel(callId)
  }
}

describe('런타임 도구 사본', () => {
  it('서술자와 입력 스키마가 넘어가고, 대리 호출은 세션 범위를 실어 데이터 쪽 구현을 부른다', async () => {
    const handler = vi.fn()
    const source = {
      snapshot: () => ({
        revision: 3,
        servers: new Map([['artifact', server('artifact', handler)]])
      })
    }
    const host = createToolCallHost({ tools: source, managedPlugins: () => new Map() })
    const port = wire(host)
    const remote = createRemoteRuntimeTools(port)
    remote.apply(structuredClone(serializeRuntimeTools(source.snapshot())))
    const proxied = remote.snapshot().servers.get('artifact')!
    expect(remote.snapshot().revision).toBe(3)
    expect(proxied.descriptor).toEqual(source.snapshot().servers.get('artifact')!.descriptor)
    const schema = z.object(proxied.implementations[0]!.inputSchema)
    expect(schema.safeParse({ path: 'a.md' }).success).toBe(true)
    expect(schema.safeParse({ path: 1 }).success).toBe(false)
    const result = await proxied.implementations[0]!.handler(
      { path: 'a.md' },
      {
        cwd: '/w',
        extraDirs: ['/x'],
        getSignal: () => new AbortController().signal,
        waitForSession: async () => 'session-7'
      }
    )
    expect(result).toEqual({ content: [{ type: 'text', text: 'ok:a.md' }] })
    expect(port.calls[0]).toMatchObject({
      origin: 'tools',
      serverId: 'artifact',
      tool: 'publish',
      input: { path: 'a.md' },
      context: { scope: 'session', cwd: '/w', extraDirs: ['/x'], sessionId: 'session-7' }
    })
    const [, context] = handler.mock.calls[0]!
    expect(await context.waitForSession(new AbortController().signal)).toBe('session-7')
  })

  it('호출 중 취소는 데이터 쪽 신호를 끊는다 · 없는 도구는 실패 결과다', async () => {
    let seen: AbortSignal | undefined
    let finish!: () => void
    const slow: RuntimeToolServer = {
      descriptor: { id: 'slow', connectorId: 'c', tools: [{ name: 'wait', description: '' }] },
      implementations: [
        {
          name: 'wait',
          inputSchema: {},
          handler: (_input, context) =>
            new Promise((resolve) => {
              seen = context!.getSignal()
              finish = () => resolve({ content: [{ type: 'text', text: 'done' }] })
            })
        }
      ]
    }
    const source = { snapshot: () => ({ revision: 1, servers: new Map([['slow', slow]]) }) }
    const host = createToolCallHost({ tools: source, managedPlugins: () => new Map() })
    const remote = createRemoteRuntimeTools(wire(host))
    remote.apply(serializeRuntimeTools(source.snapshot()))
    const controller = new AbortController()
    const pending = remote
      .snapshot()
      .servers.get('slow')!
      .implementations[0]!.handler({}, { scope: 'application', getSignal: () => controller.signal })
    await vi.waitFor(() => expect(seen).toBeDefined())
    controller.abort()
    expect(seen!.aborted).toBe(true)
    finish()
    await pending
    expect(
      await host.call({
        callId: 'x',
        origin: 'tools',
        serverId: 'none',
        tool: 'wait',
        input: {},
        context: { scope: 'application' }
      })
    ).toMatchObject({ isError: true })
  })
})

describe('관리형 MCP 사본', () => {
  it('플러그인은 인가 상태 값과 대리 서버로, 바뀐 종류와 revision 은 구독자에게 간다', async () => {
    const plugin = server('confluence')
    const snapshot: ManagedMcpSnapshot = {
      revision: 9,
      connectionRevision: 4,
      users: { a: { command: 'x' } } as never,
      plugins: new Map([
        [
          'p1',
          {
            identity: { kind: 'builtin', sourceId: 'conf', name: 'Conf', mentionId: 'conf' },
            server: plugin,
            authorized: () => true,
            credentialRevision: () => 2
          }
        ]
      ])
    }
    const leases = createManagedMcpLeaseHost({
      current: () => snapshot,
      acquire: async () => ({
        endpoints: new Map([['p1', { url: 'http://127.0.0.1:1/p1', token: 't' }]]),
        release: release
      })
    })
    const release = vi.fn(async () => {})
    const host = createToolCallHost({
      tools: { snapshot: () => ({ revision: 0, servers: new Map() }) },
      managedPlugins: () => snapshot.plugins
    })
    const remote = createRemoteManagedMcp(wire(host), leases)
    const seen = vi.fn()
    remote.subscribe(seen)
    expect(remote.peek().revision).toBe(0)
    remote.apply(structuredClone(serializeManagedMcp(snapshot, 'connections')))
    expect(seen).toHaveBeenCalledExactlyOnceWith(9, 'connections')
    const mirrored = remote.snapshot()
    expect(mirrored.connectionRevision).toBe(4)
    expect(mirrored.users).toEqual(snapshot.users)
    const entry = mirrored.plugins.get('p1')!
    expect(entry.authorized()).toBe(true)
    expect(entry.credentialRevision()).toBe(2)
    expect(
      await entry.server.implementations[0]!.handler(
        { path: 'b' },
        { scope: 'application', getSignal: () => new AbortController().signal }
      )
    ).toEqual({ content: [{ type: 'text', text: 'ok:b' }] })
    const lease = await remote.acquire(mirrored)
    expect([...lease.endpoints]).toEqual([['p1', { url: 'http://127.0.0.1:1/p1', token: 't' }]])
    await lease.release()
    await lease.release()
    expect(release).toHaveBeenCalledOnce()
    await expect(remote.acquire({ ...mirrored, revision: 99 })).rejects.toThrow('스냅샷이 없습니다')
  })

  it('참조 이름을 설정과 앱 환경에서 모은다', () => {
    expect(
      referencedVariables(
        { env: { A: '${TOKEN}', B: '${BINDING:conf}' } },
        { X: '${TOKEN}' }
      ).sort()
    ).toEqual(['BINDING:conf', 'TOKEN'])
  })
})
