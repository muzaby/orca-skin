// 0212 r3 — **preload wire 홉의 인자 충실도**(verify r2 D12).
//
// `chatApi.backgroundSubagent(sessionId, toolUseId)` 는 renderer 쪽에서 잠겼고(`chatStore`),
// main 핸들러는 `turn.live.backgroundTask` 로 잠겼다. 그 사이의 preload 한 줄만 아무도 보지
// 않아, `{ sessionId: toolUseId, toolUseId: sessionId }` 로 맞바꿔도 278파일 2790케이스가
// 전건 초록이었다 — §10 EP-14 의 `실패 의미`("인자를 흘리면 다른 태스크가 백그라운드로
// 간다")가 바로 그 상태다.
//
// preload 는 `orca` 를 값으로 export 하지 않는다. `contextBridge.exposeInMainWorld` 가 받은
// 객체를 포획해 실제 노출 표면을 그대로 부른다 — 재구현이 아니라 production 객체다.

import { describe, expect, it, vi, beforeEach } from 'vitest'
import { CHANNELS } from '../shared/ipc'
import type { OrcaApi } from './index'

const harness = vi.hoisted(() => ({
  invoke: vi.fn(async () => undefined),
  exposed: new Map<string, unknown>(),
  listeners: new Map<string, Set<(event: unknown, payload: unknown) => void>>()
}))

vi.mock('electron', () => ({
  contextBridge: {
    exposeInMainWorld: vi.fn((key: string, api: unknown) => harness.exposed.set(key, api))
  },
  ipcRenderer: {
    invoke: harness.invoke,
    on: (channel: string, listener: (event: unknown, payload: unknown) => void): void => {
      const listeners = harness.listeners.get(channel) ?? new Set()
      listeners.add(listener)
      harness.listeners.set(channel, listeners)
    },
    off: (channel: string, listener: (event: unknown, payload: unknown) => void): void => {
      harness.listeners.get(channel)?.delete(listener)
    },
    send: vi.fn()
  },
  webUtils: { getPathForFile: vi.fn(() => '/f') }
}))

// contextIsolated 가 거짓이면 모듈이 `window.orca` 분기로 가고 node 환경에는 window 가 없다.
Object.defineProperty(process, 'contextIsolated', { value: true, configurable: true })

await import('./index')

it('promotes the selected shell through the renderer API and actual preload with all identity fields', async () => {
  const api = harness.exposed.get('orca') as OrcaApi
  vi.stubGlobal('window', { orca: api })
  try {
    const { chatApi } = await import('../renderer/src/shared/api/ipc')
    harness.invoke.mockClear()
    for (const req of [
      { sessionId: 'session-a', generation: 'generation-a', toolUseId: 'shell-a' },
      { sessionId: 'session-b', generation: 'generation-b', toolUseId: 'shell-b' }
    ]) {
      await chatApi.promoteBackgroundTask(req)
      expect(harness.invoke).toHaveBeenLastCalledWith('orca:chat:promoteBackgroundTask', req)
    }
    expect(harness.invoke).toHaveBeenCalledTimes(2)
    harness.invoke.mockRejectedValueOnce(new Error('promotion failed'))
    await expect(
      api.chat.promoteBackgroundTask({ sessionId: 's', generation: 'g', toolUseId: 't' })
    ).rejects.toThrow('promotion failed')
  } finally {
    vi.unstubAllGlobals()
  }
})

it('artifact actions preserve session and publication IDs on dedicated channels', async () => {
  const api = harness.exposed.get('orca') as OrcaApi
  harness.invoke.mockClear()
  const target = { sessionId: 'original-session', publicationId: 'older-publication' }
  const batch = { sessionId: 'original-session', publicationIds: ['old', 'new'] }
  await api.artifacts.list({ sessionId: target.sessionId })
  await api.artifacts.status(batch)
  await api.artifacts.preview(target)
  await api.artifacts.save(batch)
  await api.artifacts.reveal(target)
  await api.artifacts.trash(target)
  await api.artifacts.openFolder()
  expect(harness.invoke.mock.calls).toEqual([
    [CHANNELS.artifactList, { sessionId: target.sessionId }],
    [CHANNELS.artifactStatus, batch],
    [CHANNELS.artifactPreview, target],
    [CHANNELS.artifactSave, batch],
    [CHANNELS.artifactReveal, target],
    [CHANNELS.artifactTrash, target],
    [CHANNELS.artifactOpenFolder]
  ])
})

it('artifact catalog and pin state preserve their exact IPC requests', async () => {
  const api = harness.exposed.get('orca') as OrcaApi
  harness.invoke.mockClear()
  const request = { sessionId: 'owner', publicationId: 'selected', pinned: false }
  await api.artifacts.catalog()
  await api.artifacts.setPinned(request)
  expect(harness.invoke.mock.calls).toEqual([
    [CHANNELS.artifactCatalog, {}],
    [CHANNELS.artifactSetPinned, request]
  ])
})

type ChatApi = {
  backgroundSubagent: (sessionId: string, toolUseId: string) => Promise<void>
  stopSubagent: (sessionId: string, toolUseId: string) => Promise<void>
}

function chat(): ChatApi {
  const api = harness.exposed.get('orca') as { chat: ChatApi } | undefined
  if (!api) throw new Error('preload 가 orca 를 노출하지 않았다 — contextBridge 포획 실패')
  return api.chat
}

describe('preload orca.chat — 서브에이전트 제어 wire 홉 (0212 §10 EP-14)', () => {
  beforeEach(() => harness.invoke.mockClear())

  // 두 번 부르고 인자를 서로 다르게 준다 — 한 번이면 상수로 굳힌 payload 도 통과하고,
  // 두 필드가 같은 타입이라 맞바꿈은 값이 달라야만 드러난다.
  it('backgroundSubagent 는 받은 두 값을 각자의 필드에 실어 보낸다', async () => {
    await chat().backgroundSubagent('sess-1', 'use-1')
    await chat().backgroundSubagent('sess-2', 'use-2')

    expect(harness.invoke.mock.calls).toEqual([
      [CHANNELS.chatBackgroundSubagent, { sessionId: 'sess-1', toolUseId: 'use-1' }],
      [CHANNELS.chatBackgroundSubagent, { sessionId: 'sess-2', toolUseId: 'use-2' }]
    ])
  })

  it('stopSubagent 도 같은 규칙이다 — 같은 좌표를 쓰는 형제 채널이다', async () => {
    await chat().stopSubagent('sess-1', 'use-1')
    await chat().stopSubagent('sess-2', 'use-2')

    expect(harness.invoke.mock.calls).toEqual([
      [CHANNELS.chatStopSubagent, { sessionId: 'sess-1', toolUseId: 'use-1' }],
      [CHANNELS.chatStopSubagent, { sessionId: 'sess-2', toolUseId: 'use-2' }]
    ])
  })

  it('두 채널은 서로 다른 채널 상수를 쓴다 — 맞바꿔도 위 두 케이스는 침묵한다', () => {
    expect(CHANNELS.chatBackgroundSubagent).not.toBe(CHANNELS.chatStopSubagent)
  })
})

interface EventEndpoint {
  name: string
  channel: string
  subscribe: (api: OrcaApi, handler: (payload: unknown) => void) => () => void
}

// 공개 API에서 구독한다. 내부 helper만 시험하면 endpoint의 잘못된 채널 연결을 놓친다.
const eventEndpoints: EventEndpoint[] = [
  {
    name: 'chat.onEvent',
    channel: CHANNELS.chatEvent,
    subscribe: (api, handler) => api.chat.onEvent(handler)
  },
  {
    name: 'install.onStatus',
    channel: CHANNELS.installStatus,
    subscribe: (api, handler) => api.install.onStatus(handler)
  },
  {
    name: 'session.onTitle',
    channel: CHANNELS.sessionTitleEvent,
    subscribe: (api, handler) => api.session.onTitle(handler)
  },
  {
    name: 'cost.onUsage',
    channel: CHANNELS.costUsageEvent,
    subscribe: (api, handler) => api.cost.onUsage(handler)
  },
  {
    name: 'provider.onState',
    channel: CHANNELS.providerState,
    subscribe: (api, handler) => api.provider.onState(handler)
  },
  {
    name: 'concurrency.onEvent',
    channel: CHANNELS.concurrencyEvent,
    subscribe: (api, handler) => api.concurrency.onEvent(handler)
  },
  {
    name: 'update.onState',
    channel: CHANNELS.updateStateEvent,
    subscribe: (api, handler) => api.update.onState(handler)
  },
  {
    name: 'update.onProgress',
    channel: CHANNELS.updateProgressEvent,
    subscribe: (api, handler) => api.update.onProgress(handler)
  }
]

describe('preload public event subscriptions', () => {
  beforeEach(() => harness.listeners.clear())

  it.each(eventEndpoints)(
    '$name keeps its channel, strips the Electron event and releases only its own listener',
    (endpoint) => {
      const api = harness.exposed.get('orca') as OrcaApi
      const first = vi.fn()
      const second = vi.fn()
      const stopFirst = endpoint.subscribe(api, first)
      const stopSecond = endpoint.subscribe(api, second)
      const electronEvent = { sender: { privileged: true } }
      const firstPayload = { source: endpoint.name, revision: 1 }
      const emit = (channel: string, payload: unknown): void => {
        for (const listener of harness.listeners.get(channel) ?? [])
          listener(electronEvent, payload)
      }

      for (const other of eventEndpoints) {
        if (other.channel !== endpoint.channel) emit(other.channel, { unexpected: true })
      }
      expect(first).not.toHaveBeenCalled()
      expect(second).not.toHaveBeenCalled()
      emit(endpoint.channel, firstPayload)
      expect(first).toHaveBeenCalledExactlyOnceWith(firstPayload)
      expect(second).toHaveBeenCalledExactlyOnceWith(firstPayload)

      stopFirst()
      stopFirst()
      const secondPayload = { source: endpoint.name, revision: 2 }
      emit(endpoint.channel, secondPayload)
      expect(first).toHaveBeenCalledOnce()
      expect(second.mock.calls).toEqual([[firstPayload], [secondPayload]])
      stopSecond()
      emit(endpoint.channel, { revision: 3 })
      expect(second).toHaveBeenCalledTimes(2)
      expect(harness.listeners.get(endpoint.channel)?.size).toBe(0)
    }
  )
})
