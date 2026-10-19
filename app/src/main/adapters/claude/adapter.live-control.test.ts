import { nativePluginId } from './configured-resources'
// 0212 r3 — **어댑터 → SDK 제어 홉의 인자 충실도**(AC25 production path 의 마지막 화살표).
//
// `SessionRuntime.backgroundTask` 가 부르는 포트의 실제 구현이 여기다. 상위 홉을 전부 잠가도
// 이 람다가 인자를 흘리면 다른 태스크가 백그라운드로 간다 — verify r2 가 §10 EP-14 의
// `실패 의미` 로 적은 상태다. 재측정(2026-09-02): `handle.backgroundTasks(toolUseId + '-x')`
// 로 오염시켜도 2798케이스가 전건 초록이었다.
//
// 이 파일이 없으면 `claude.ts:503-507` 세 줄의 인자 전달을 보는 단언이 0이 된다.

import { describe, it, expect, vi } from 'vitest'
import type { McpServerStatus, SDKMessage } from '@anthropic-ai/claude-agent-sdk'

const { queryMock, control, messages } = vi.hoisted(() => {
  const messages: SDKMessage[] = []
  const control = {
    mcpServerStatus: vi.fn(async (): Promise<McpServerStatus[]> => [
      { name: 'native-A', status: 'connected' }
    ]),
    toggleMcpServer: vi.fn<(name: string, enabled: boolean) => Promise<void>>(async () => {}),
    setModel: vi.fn(async () => {}),
    stopTask: vi.fn(async () => {}),
    backgroundTasks: vi.fn(async () => true),
    setPermissionMode: vi.fn(async () => {}),
    interrupt: vi.fn(async () => undefined)
  }
  return {
    control,
    messages,
    queryMock: vi.fn(() => {
      const iterable = {
        async *[Symbol.asyncIterator]() {
          for (const message of messages) yield message
        },
        ...control
      }
      return iterable as unknown as AsyncIterable<never>
    })
  }
})

vi.mock('@anthropic-ai/claude-agent-sdk', async (original) => ({
  ...(await original<typeof import('@anthropic-ai/claude-agent-sdk')>()),
  query: queryMock
}))

import { ClaudeAdapter } from './adapter'
import type { TurnRequest } from '../common/turn'

const baseReq = (): TurnRequest => ({
  sessionId: null,
  text: 'hello',
  cwd: '/tmp',
  extensions: { skills: [], hooks: { normalized: {} } }
})

describe('ClaudeAdapter — live 제어 위임의 인자 (0212 AC25 경로 끝)', () => {
  it('converts every normalized live permission mode at the native SDK boundary', async () => {
    control.setPermissionMode.mockClear()
    const live = new ClaudeAdapter().sendMessage(baseReq())
    for (const mode of [
      'default',
      'accept_edits',
      'plan',
      'dont_ask',
      'bypass',
      'auto_classified'
    ] as const) {
      await live.setPermissionMode(mode)
    }
    expect(control.setPermissionMode.mock.calls).toEqual([
      ['default'],
      ['acceptEdits'],
      ['plan'],
      ['dontAsk'],
      ['bypassPermissions'],
      ['auto']
    ])
    live.close()
  })
  // 두 번 부르고 값을 다르게 준다 — 한 번이면 인자를 상수로 굳힌 위임도 통과한다.
  it('backgroundTask 는 받은 toolUseId 로 SDK backgroundTasks 를 부르고 반환을 그대로 돌려준다', async () => {
    const live = new ClaudeAdapter().sendMessage(baseReq())

    expect(await live.backgroundTask('use1')).toBe(true)
    expect(await live.backgroundTask('use2')).toBe(true)

    expect(control.backgroundTasks.mock.calls).toEqual([['use1'], ['use2']])
  })

  it('stopTask·setModel 도 받은 값을 그대로 넘긴다 — 같은 형상의 형제 위임이다', async () => {
    const live = new ClaudeAdapter().sendMessage(baseReq())

    await live.stopTask('task-1')
    await live.stopTask('task-2')
    await live.setModel('opus')
    await live.setModel('sonnet')

    expect(control.stopTask.mock.calls).toEqual([['task-1'], ['task-2']])
    expect(control.setModel.mock.calls).toEqual([['opus'], ['sonnet']])
  })
})

it('wires native status, loaded plugins, injected exclusions and session-local toggles to the Query', async () => {
  control.toggleMcpServer.mockClear()
  messages.push({
    type: 'system',
    subtype: 'init',
    session_id: 'native-session',
    uuid: 'init-id',
    tools: [],
    mcp_servers: [],
    plugins: [
      { name: 'native-plugin', path: '/native' },
      { name: 'orca', path: '/injected' }
    ]
  } as unknown as SDKMessage)
  const request = baseReq()
  request.extensions.pluginRoots = ['/injected']
  request.extensions.runtimeTools = {
    revision: 1,
    servers: new Map([
      [
        'runtime-A',
        { descriptor: { id: 'runtime-A', connectorId: 'fixture', tools: [] }, implementations: [] }
      ]
    ])
  }
  control.mcpServerStatus.mockResolvedValueOnce([
    { name: 'native-A', status: 'connected' },
    { name: 'runtime-A', status: 'connected' }
  ])
  const live = new ClaudeAdapter().sendMessage(request)
  const iterator = live.eventBatches[Symbol.asyncIterator]()
  try {
    await iterator.next()
    const result = await live.nativeResources?.()
    expect(result).toEqual({
      state: 'connected',
      generation: live.providerGeneration,
      items: [
        {
          id: 'native-A',
          name: 'native-A',
          kind: 'mcp',
          status: 'connected',
          enabled: true,
          canToggle: true
        },
        {
          id: nativePluginId('/native'),
          name: 'native-plugin',
          kind: 'plugin',
          status: 'enabled',
          enabled: true,
          canToggle: false
        }
      ]
    })
    for (const enabled of [false, true])
      await live.setNativeResource?.({
        sessionId: 'native-session',
        generation: result!.generation!,
        kind: 'mcp',
        id: 'native-A',
        enabled
      })
    expect(control.toggleMcpServer.mock.calls).toEqual([
      ['native-A', false],
      ['native-A', true]
    ])
    await expect(
      live.setNativeResource?.({
        sessionId: 'native-session',
        generation: 'old',
        kind: 'mcp',
        id: 'native-A',
        enabled: false
      })
    ).rejects.toThrow()
    await expect(
      live.setNativeResource?.({
        sessionId: 'native-session',
        generation: result!.generation!,
        kind: 'plugin',
        id: nativePluginId('/native'),
        enabled: false
      })
    ).rejects.toThrow()
  } finally {
    live.close()
    await iterator.return?.()
    messages.length = 0
  }
})
