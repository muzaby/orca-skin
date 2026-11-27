// `window.oo` 전송층의 인자 충실도·전송 선택 (0212 r3 · 0324 AC24″ · D-058).
//
// `chatApi.backgroundSubagent(sessionId, toolUseId)` 는 renderer 쪽에서 잠겼고(`chatStore`),
// main 핸들러는 `turn.live.backgroundTask` 로 잠겼다. 그 사이의 전송 한 줄만 아무도 보지
// 않아, `{ sessionId: toolUseId, toolUseId: sessionId }` 로 맞바꿔도 278파일 2790케이스가
// 전건 초록이었다 — §10 EP-14 의 `실패 의미`("인자를 흘리면 다른 태스크가 백그라운드로
// 간다")가 바로 그 상태다.
//
// 재구현이 아니라 production 설치(`installOo`)가 흉내 창에 만든 `window.oo` 를 그대로 부른다. preload 다리는
// 셸 채널을 기록하는 흉내이고, 호스트 포트는 같은 창의 `message` 이벤트로 넘긴다 — preload 가 하는 일과 같다.

import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  CHANNELS,
  type HarnessAvailability,
  type OpenContextFileResult
} from '../../../../../shared/ipc'
import { CHANNEL_OWNER } from '../../../../../shared/channel-owner'
import { HOST_PORT_MESSAGE } from '../../../../../shared/host-channels'
import { LOG_IPC_PAYLOAD_MAX_BYTES } from '../../../../../shared/logging'
import type { OoBridge } from '../../../../../preload/index'
import { installOo, type OoWindow } from './install'
import type { OoApi } from './oo'

const harness = {
  invoke: vi.fn<(...args: unknown[]) => Promise<unknown>>().mockResolvedValue(undefined),
  listeners: new Map<string, Set<(payload: unknown) => void>>(),
  sent: [] as Array<[string, unknown]>,
  // 요청·송신이 어느 전송으로 갔는가 — 셸은 preload 다리, 호스트는 그 호스트의 포트(0324 AC24″).
  routes: [] as Array<[string, 'shell' | 'agent' | 'data']>
}

// preload 다리 흉내 — 셸 채널 요청·송신·구독을 기록한다. 셸 채널 판정은 `src/preload/index.test.ts` 가 본다.
const bridge: OoBridge = {
  invoke: (...args: [string, unknown?]) => {
    harness.routes.push([args[0], 'shell'])
    return harness.invoke(...args)
  },
  send: (channel, payload) => {
    harness.sent.push([channel, payload])
  },
  on: (channel, handler) => {
    const listeners = harness.listeners.get(channel) ?? new Set()
    listeners.add(handler)
    harness.listeners.set(channel, listeners)
    return () => {
      harness.listeners.get(channel)?.delete(handler)
    }
  },
  connectHost: vi.fn(),
  onHostExited: () => () => {},
  pathForFile: () => '/f',
  platform: 'linux'
}

const messageListeners: Array<(event: MessageEvent) => void> = []
const win: OoWindow = {
  ooBridge: bridge,
  addEventListener: (_type, listener) => {
    messageListeners.push(listener)
  }
}

// 셸이 넘기는 호스트 포트 — 요청은 같은 `harness.invoke` 로 받아 답하고, 통지는 `emitEvent` 로 보낸다.
// 요청이 어느 전송으로 갔는지는 `routes` 가 기록한다(0324 AC24″).
const hostPorts = new Map<'agent' | 'data', { deliver(data: unknown): void }>()
function deliverHostPort(host: 'agent' | 'data'): void {
  let onmessage: ((event: { data: unknown }) => void) | null = null
  const port = {
    set onmessage(listener: (event: { data: unknown }) => void) {
      onmessage = listener
    },
    postMessage: (message: { kind: string; id?: number; channel: string; payload?: unknown }) => {
      harness.routes.push([message.channel, host])
      if (message.kind !== 'invoke') return
      const args =
        message.payload === undefined ? [message.channel] : [message.channel, message.payload]
      void Promise.resolve()
        .then(() => harness.invoke(...args))
        .then(
          (value) => onmessage?.({ data: { kind: 'result', id: message.id, ok: true, value } }),
          (error: unknown) =>
            onmessage?.({
              data: { kind: 'result', id: message.id, ok: false, error: (error as Error).message }
            })
        )
    },
    close: () => {}
  }
  hostPorts.set(host, { deliver: (data) => onmessage?.({ data }) })
  const event = {
    source: win,
    data: { type: HOST_PORT_MESSAGE, host },
    ports: [port]
  } as unknown as MessageEvent
  for (const listener of messageListeners) listener(event)
}

// 통지 하나 — 소유 프로세스의 전송으로 보낸다(호스트 채널은 포트, 셸 채널은 다리).
function emitEvent(channel: string, payload: unknown): void {
  const owner = (CHANNEL_OWNER as Record<string, string>)[
    Object.keys(CHANNELS).find((key) => (CHANNELS as Record<string, string>)[key] === channel)!
  ]
  if (owner === 'agent' || owner === 'data') {
    hostPorts.get(owner)!.deliver({ kind: 'event', channel, payload })
    return
  }
  for (const listener of harness.listeners.get(channel) ?? []) listener(payload)
}

expect(installOo(win)).toBe('installed')
deliverHostPort('agent')
deliverHostPort('data')

// 하네스 가용성 통지와 재확인은 에이전트 호스트 채널이다 — 셸이 넘긴 에이전트 포트로 오간다(0324 AC24′).
it('carries availability changes and invokes recheck with the requested harness over the agent port', async () => {
  const api = win.oo as OoApi
  const from = harness.routes.length
  harness.invoke.mockClear()
  const state: HarnessAvailability = {
    id: 'opencode',
    installed: false,
    usable: false,
    unavailableReason: 'missing'
  }
  const received = vi.fn(),
    stop = api.harness.onAvailability(received)
  emitEvent(CHANNELS.harnessAvailability, state)
  expect(received).toHaveBeenCalledExactlyOnceWith(state)
  harness.invoke.mockResolvedValueOnce(state)
  expect(await api.harness.recheck('opencode')).toEqual(state)
  expect(harness.invoke).toHaveBeenCalledExactlyOnceWith(CHANNELS.harnessRecheck, {
    backend: 'opencode'
  })
  expect(harness.routes.slice(from)).toEqual([[CHANNELS.harnessRecheck, 'agent']])
  stop()
  emitEvent(CHANNELS.harnessAvailability, state)
  expect(received).toHaveBeenCalledOnce()
})

it('forwards backend extension changes through preload and renderer and removes the listener', async () => {
  vi.stubGlobal('window', { oo: win.oo as OoApi })
  try {
    const { sessionApi } = await import('../ipc')
    const seen = vi.fn()
    const off = sessionApi.onExtensionsChanged(seen)!
    for (const backend of ['claude', 'opencode']) emitEvent(CHANNELS.extensionsChanged, { backend })
    expect(seen.mock.calls).toEqual([[{ backend: 'claude' }], [{ backend: 'opencode' }]])
    off()
    emitEvent(CHANNELS.extensionsChanged, { backend: 'claude' })
    expect(seen).toHaveBeenCalledTimes(2)
  } finally {
    vi.unstubAllGlobals()
  }
})

it('carries managed MCP revision events through the actual preload and renderer subscription', async () => {
  vi.stubGlobal('window', { oo: win.oo as OoApi })
  try {
    const { sessionApi } = await import('../ipc')
    const seen = vi.fn()
    const off = sessionApi.onManagedMcpChanged(seen)!
    emitEvent(CHANNELS.managedMcpChanged, { revision: 37 })
    expect(seen).toHaveBeenCalledExactlyOnceWith({ revision: 37 })
    off()
    emitEvent(CHANNELS.managedMcpChanged, { revision: 38 })
    expect(seen).toHaveBeenCalledOnce()
  } finally {
    vi.unstubAllGlobals()
  }
})

it('carries explicit global extension scope and choices across renderer API and preload', async () => {
  vi.stubGlobal('window', { oo: win.oo as OoApi })
  try {
    const { sessionApi } = await import('../ipc')
    await sessionApi.globalExtensions('opencode')
    expect(harness.invoke).toHaveBeenLastCalledWith(CHANNELS.extensionCatalog, {
      backend: 'opencode'
    })
    const request = {
      backend: 'claude' as const,
      kind: 'plugin' as const,
      id: 'plugin:installed',
      enabled: false
    }
    const applied = { status: 'applied', resources: { state: 'disconnected', items: [] } }
    harness.invoke.mockResolvedValueOnce(applied)
    expect(await sessionApi.setGlobalExtension(request)).toEqual(applied)
    expect(harness.invoke).toHaveBeenLastCalledWith(CHANNELS.extensionSetEnabled, request)
    await sessionApi.openGlobalExtension({ backend: 'opencode', kind: 'mcp', id: 'docs' })
    expect(harness.invoke).toHaveBeenLastCalledWith(CHANNELS.extensionOpen, {
      backend: 'opencode',
      kind: 'mcp',
      id: 'docs'
    })
  } finally {
    vi.unstubAllGlobals()
  }
})

it.each(['claude', 'opencode'] as const)(
  'preserves %s engine CRUD identities through the renderer API and actual preload',
  async (engine) => {
    vi.stubGlobal('window', { oo: win.oo as OoApi })
    try {
      const { engineApi, agentApi } = await import('../ipc')
      const key = `${engine}-nondefault`
      const settingsJson = JSON.stringify({ fixture: `${engine}-settings` })
      const created = { key, engine, provider: 'nondefault' }
      harness.invoke.mockClear()
      harness.invoke.mockResolvedValueOnce(created)
      expect(await engineApi.add({ engine, provider: 'nondefault', settingsJson })).toBe(created)
      expect(harness.invoke).toHaveBeenLastCalledWith(CHANNELS.engineAdd, {
        engine,
        provider: 'nondefault',
        settingsJson
      })
      const read = { ...created, settingsJson }
      harness.invoke.mockResolvedValueOnce(read)
      expect(await engineApi.read(key)).toBe(read)
      expect(harness.invoke).toHaveBeenLastCalledWith(CHANNELS.engineRead, { key })
      harness.invoke.mockResolvedValueOnce(created)
      expect(await engineApi.update({ key, settingsJson })).toBe(created)
      expect(harness.invoke).toHaveBeenLastCalledWith(CHANNELS.engineUpdate, { key, settingsJson })
      await engineApi.delete(key)
      expect(harness.invoke).toHaveBeenLastCalledWith(CHANNELS.engineDelete, { key })
      const catalog = [{ key, adapter: engine, supported: true, models: [] }]
      harness.invoke.mockResolvedValueOnce(catalog)
      expect(await agentApi.list()).toBe(catalog)
      expect(harness.invoke).toHaveBeenLastCalledWith(CHANNELS.agentList)
      expect(harness.invoke).toHaveBeenCalledTimes(5)
    } finally {
      harness.invoke.mockResolvedValue(undefined)
      vi.unstubAllGlobals()
    }
  }
)

it('imports settings for the selected harness through the renderer wrapper and exposed preload', async () => {
  vi.stubGlobal('window', { oo: win.oo as OoApi })
  try {
    const { engineApi } = await import('../ipc')
    const result = { exists: true, settingsJson: '{"fixture":true}' }
    harness.invoke.mockResolvedValue(result)
    for (const engine of ['opencode', 'claude'] as const) {
      expect(await engineApi.importUserSettings(engine)).toEqual(result)
      expect(harness.invoke).toHaveBeenLastCalledWith(CHANNELS.engineImportUserSettings, { engine })
    }
    await engineApi.importUserSettings()
    expect(harness.invoke).toHaveBeenLastCalledWith(CHANNELS.engineImportUserSettings, {
      engine: 'claude'
    })
  } finally {
    harness.invoke.mockResolvedValue(undefined)
    vi.unstubAllGlobals()
  }
})

it('reveals logs through the renderer wrapper and exposed preload on the dedicated no-input channel', async () => {
  const api = win.oo as OoApi
  vi.stubGlobal('window', { oo: api })
  try {
    const { errorApi } = await import('../ipc')
    harness.invoke.mockClear()
    await errorApi.revealLog()
    expect(harness.invoke).toHaveBeenCalledExactlyOnceWith('oo:error:revealLog')
    harness.invoke.mockRejectedValueOnce(new Error('folder denied'))
    await expect(errorApi.revealLog()).rejects.toThrow('folder denied')
  } finally {
    vi.unstubAllGlobals()
  }
})

it('promotes the selected shell through the renderer API and actual preload with all identity fields', async () => {
  const api = win.oo as OoApi
  vi.stubGlobal('window', { oo: api })
  try {
    const { chatApi } = await import('../ipc')
    harness.invoke.mockClear()
    for (const req of [
      { sessionId: 'session-a', generation: 'generation-a', toolUseId: 'shell-a' },
      { sessionId: 'session-b', generation: 'generation-b', toolUseId: 'shell-b' }
    ]) {
      await chatApi.promoteBackgroundTask(req)
      expect(harness.invoke).toHaveBeenLastCalledWith('oo:chat:promoteBackgroundTask', req)
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

it('sends all held inputs now through the renderer API and actual preload using the session key', async () => {
  const api = win.oo as OoApi
  vi.stubGlobal('window', { oo: api })
  try {
    const { chatApi } = await import('../ipc')
    harness.invoke.mockClear()
    const request = { sessionId: 'queued-session' }
    await chatApi.sendSteerNow(request)
    expect(harness.invoke).toHaveBeenCalledExactlyOnceWith(CHANNELS.chatSteerSendNow, request)
    harness.invoke.mockRejectedValueOnce(new Error('interrupt denied'))
    await expect(chatApi.sendSteerNow(request)).rejects.toThrow('interrupt denied')
  } finally {
    vi.unstubAllGlobals()
  }
})

it('opens a context file through the renderer wrapper and actual preload with unchanged results', async () => {
  const api = win.oo as OoApi
  vi.stubGlobal('window', { oo: api })
  try {
    const { fileApi } = await import('../ipc')
    const request = { path: 'C:/work/a.md', sessionId: 'owner' }
    harness.invoke.mockClear()
    const outcomes: OpenContextFileResult[] = [
      { outcome: 'opened' },
      { outcome: 'revealed', reason: 'open-failed' },
      { outcome: 'revealed', reason: 'unsupported-type' },
      { outcome: 'missing' }
    ]
    for (const outcome of outcomes) {
      harness.invoke.mockResolvedValueOnce(outcome)
      await expect(fileApi.openContextFile(request)).resolves.toBe(outcome)
      expect(harness.invoke).toHaveBeenLastCalledWith('oo:files:openContextFile', request)
    }
    expect(harness.invoke).toHaveBeenCalledTimes(4)
    harness.invoke.mockRejectedValueOnce(new Error('scope rejected'))
    await expect(fileApi.openContextFile(request)).rejects.toThrow('scope rejected')
  } finally {
    vi.unstubAllGlobals()
  }
})

it('artifact actions preserve session and publication IDs on dedicated channels', async () => {
  const api = win.oo as OoApi
  harness.invoke.mockClear()
  const target = { sessionId: 'original-session', publicationId: 'older-publication' }
  const batch = { sessionId: 'original-session', publicationIds: ['old', 'new'] }
  await api.artifacts.list({ sessionId: target.sessionId })
  await api.artifacts.status(batch)
  await api.artifacts.preview(target)
  await api.artifacts.save(batch)
  await api.artifacts.reveal(target)
  await api.artifacts.trash(target)
  expect(harness.invoke.mock.calls).toEqual([
    [CHANNELS.artifactList, { sessionId: target.sessionId }],
    [CHANNELS.artifactStatus, batch],
    [CHANNELS.artifactPreview, target],
    [CHANNELS.artifactSave, batch],
    [CHANNELS.artifactReveal, target],
    [CHANNELS.artifactTrash, target]
  ])
})

it('artifact catalog and pin state preserve their exact IPC requests', async () => {
  const api = win.oo as OoApi
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
  const api = win.oo as { chat: ChatApi } | undefined
  if (!api) throw new Error('`installOo` 가 `window.oo` 를 만들지 않았다')
  return api.chat
}

describe('preload oo.chat — 서브에이전트 제어 wire 홉 (0212 §10 EP-14)', () => {
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
  subscribe: (api: OoApi, handler: (payload: unknown) => void) => () => void
}

// 공개 API에서 구독한다. 내부 helper만 시험하면 endpoint의 잘못된 채널 연결을 놓친다.
const eventEndpoints: EventEndpoint[] = [
  {
    name: 'session.onComposerCatalogInvalidated',
    channel: CHANNELS.composerCatalogInvalidated,
    subscribe: (api, handler) => api.session.onComposerCatalogInvalidated(handler)
  },
  {
    name: 'session.onNativeResourcesChanged',
    channel: CHANNELS.sessionNativeResourcesChanged,
    subscribe: (api, handler) => api.session.onNativeResourcesChanged(handler)
  },
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
  it.each(eventEndpoints)(
    '$name keeps its channel, strips the Electron event and releases only its own listener',
    (endpoint) => {
      const api = win.oo as OoApi
      const first = vi.fn()
      const second = vi.fn()
      const stopFirst = endpoint.subscribe(api, first)
      const stopSecond = endpoint.subscribe(api, second)
      const firstPayload = { source: endpoint.name, revision: 1 }
      const emit = emitEvent

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
    }
  )
})

it('wires DB load and lazy refresh as separate calls with the same stored session ID', async () => {
  vi.stubGlobal('window', { oo: win.oo as OoApi })
  try {
    const { sessionApi } = await import('../ipc')
    const loaded = {
      id: 'native-session',
      backend: 'opencode',
      agentKind: 'code',
      complete: false,
      title: null,
      history: { generation: 'g' },
      messages: []
    }
    harness.invoke
      .mockClear()
      .mockImplementationOnce(async (_channel, args) => ({
        ...(args as object),
        status: 'ok',
        session: loaded
      }))
      .mockResolvedValueOnce({ status: 'unchanged' })
    expect(await sessionApi.load('native-session')).toEqual(loaded)
    expect(harness.invoke).toHaveBeenCalledExactlyOnceWith(CHANNELS.sessionHistoryPage, {
      kind: 'latest',
      openGeneration: expect.any(Number),
      sessionId: 'native-session',
      requestId: expect.any(Number)
    })
    expect(await sessionApi.refresh('native-session')).toEqual({ status: 'unchanged' })
    expect(harness.invoke).toHaveBeenLastCalledWith(CHANNELS.sessionRefresh, {
      openGeneration: expect.any(Number),
      sessionId: 'native-session',
      requestId: expect.any(Number)
    })
  } finally {
    harness.invoke.mockResolvedValue(undefined)
    vi.unstubAllGlobals()
  }
})

it('preserves native resource state and toggle identity through renderer and preload', async () => {
  vi.stubGlobal('window', { oo: win.oo as OoApi })
  try {
    const { sessionApi } = await import('../ipc')
    const catalogRequest = {
      owner: 'owner-B',
      part: 'agents' as const,
      scope: {
        backend: 'opencode' as const,
        sessionId: null,
        cwd: 'C:/draft',
        projectId: 'project-C',
        providerKey: 'opencode-native',
        agentKind: 'code' as const
      }
    }
    const catalog = { part: 'agents', value: [{ name: 'Atlas' }], generation: 'catalog-g' }
    harness.invoke.mockResolvedValue(catalog)
    expect(await sessionApi.composerCatalog(catalogRequest)).toBe(catalog)
    expect(harness.invoke).toHaveBeenLastCalledWith(CHANNELS.composerCatalog, catalogRequest)
    for (const part of ['mcp', 'plugins'] as const) {
      const request = { ...catalogRequest, part }
      const result = { part, value: [], generation: 'resource-g' }
      harness.invoke.mockResolvedValue(result)
      expect(await sessionApi.composerCatalog(request)).toBe(result)
      expect(harness.invoke).toHaveBeenLastCalledWith(CHANNELS.composerCatalog, request)
    }
    const cancelled = { part: 'agents', status: 'cancelled' }
    harness.invoke.mockResolvedValue(cancelled)
    expect(await sessionApi.composerCatalog(catalogRequest)).toBe(cancelled)
    await sessionApi.releaseComposerCatalog(catalogRequest.owner)
    expect(harness.invoke).toHaveBeenLastCalledWith(CHANNELS.composerCatalogRelease, {
      owner: 'owner-B'
    })
    const result = {
      state: 'connected',
      generation: 'native-generation',
      items: [{ id: 'a', kind: 'mcp', enabled: false }]
    }
    harness.invoke.mockResolvedValue(result)
    expect(await sessionApi.nativeResources('session-B')).toBe(result)
    expect(harness.invoke).toHaveBeenLastCalledWith(CHANNELS.sessionNativeResources, {
      sessionId: 'session-B'
    })
    const draft = { backend: 'claude' as const, cwd: 'C:/draft-B', projectId: 'project-B' }
    expect(await sessionApi.nativeResources(draft)).toBe(result)
    const observation = { owner: 'panel:1', active: true }
    await sessionApi.nativeResources(draft, observation)
    expect(harness.invoke).toHaveBeenLastCalledWith(CHANNELS.sessionNativeResources, {
      ...draft,
      observation
    })
    await sessionApi.nativeResources('session-B', { ...observation, active: false })
    expect(harness.invoke).toHaveBeenLastCalledWith(CHANNELS.sessionNativeResources, {
      sessionId: 'session-B',
      observation: { ...observation, active: false }
    })
    await sessionApi.nativeResources(draft)
    expect(harness.invoke).toHaveBeenLastCalledWith(CHANNELS.sessionNativeResources, draft)
  } finally {
    harness.invoke.mockResolvedValue(undefined)
    vi.unstubAllGlobals()
  }
})

it('forwards OpenCode plugin changes on their own channel', async () => {
  vi.stubGlobal('window', { oo: win.oo as OoApi })
  try {
    const { sessionApi } = await import('../ipc')
    const changed = vi.fn()
    const stop = sessionApi.onOpenCodePluginsChanged(changed)!
    for (const revision of [2, 7]) emitEvent('oo:extensions:opencode-plugins-changed', { revision })
    expect(changed.mock.calls).toEqual([[{ revision: 2 }], [{ revision: 7 }]])
    expect(CHANNELS.extensionOpenCodePluginsChanged).toBe('oo:extensions:opencode-plugins-changed')
    stop()
    emitEvent(CHANNELS.extensionOpenCodePluginsChanged, { revision: 9 })
    expect(changed).toHaveBeenCalledTimes(2)
  } finally {
    vi.unstubAllGlobals()
  }
})

// 0291 — 로그인 프리 연결 요청이 renderer API → preload → `oo:provider:connect` 로 그대로 간다.
it('carries the login-free connect request and its final state through the actual preload', async () => {
  vi.stubGlobal('window', { oo: win.oo as OoApi })
  try {
    const { providerApi } = await import('../ipc')
    const result = { state: 'failed', message: 'OpenCode가 설치되어 있지 않습니다.' }
    harness.invoke.mockResolvedValueOnce(result)
    expect(await providerApi.connect({ providerId: 'opencode-llm' })).toEqual(result)
    expect(harness.invoke).toHaveBeenLastCalledWith(CHANNELS.providerConnect, {
      providerId: 'opencode-llm'
    })
  } finally {
    vi.unstubAllGlobals()
  }
})

// 0324 AC24′ · VP-21′ — 채널마다 처리하는 프로세스가 하나다. 이 파일의 모든 요청이 소유 표의 전송으로만
// 갔는지 본다(셸 채널 → ipcRenderer, 호스트 채널 → 그 호스트의 포트).
const ownerOfChannel = (channel: string): string =>
  (CHANNEL_OWNER as Record<string, string>)[
    Object.keys(CHANNELS).find((key) => (CHANNELS as Record<string, string>)[key] === channel)!
  ]

it('요청은 소유 프로세스의 전송 하나로만 간다 — 셸·에이전트·데이터 (AC24′)', async () => {
  const api = win.oo as OoApi
  harness.routes.length = 0
  await api.boot.whenReady()
  await api.chat.cancel('s1')
  await api.settings.get()
  expect(harness.routes).toEqual([
    [CHANNELS.bootWhenReady, 'shell'],
    [CHANNELS.chatCancel, 'agent'],
    [CHANNELS.settingsGet, 'data']
  ])
})

// 로그(0123)는 셸 채널 단방향 송신 하나다 — 크기 상한을 넘거나 직렬화할 수 없는 입력은 조용히 버린다.
it('로그는 셸 다리로 한 번 보내고, 크기 상한을 넘는 입력은 버린다', () => {
  const api = win.oo as OoApi
  const from = harness.sent.length
  api.log.info('event.small', 'scope', { n: 1 })
  api.log.info('event.big', 'scope', { blob: 'x'.repeat(LOG_IPC_PAYLOAD_MAX_BYTES) })
  expect(harness.sent.slice(from)).toEqual([
    [CHANNELS.logEmit, { level: 'info', event: 'event.small', scope: 'scope', data: { n: 1 } }]
  ])
})

// 파일 경로는 다리가 준다 — 전송층이 다른 값을 만들지 않는다.
it('파일 경로는 다리의 `pathForFile` 값이다', () => {
  const api = win.oo as OoApi
  expect(api.files.pathForFile({ name: 'a.txt' } as File)).toBe('/f')
})

// 기대 소유자를 표에서 읽지 않고 고정한다 — 표 자체가 한쪽으로 쏠려도 잡는다(VP-21′ 선택 증거).
it('턴 전송은 에이전트 포트, 세션 목록은 데이터 포트로 간다 (AC24′)', async () => {
  const api = win.oo as OoApi
  const from = harness.routes.length
  await api.chat.send({ sessionId: 's1', text: 'hi' } as Parameters<OoApi['chat']['send']>[0])
  await api.session.list()
  expect(harness.routes.slice(from)).toEqual([
    [CHANNELS.chatSend, 'agent'],
    [CHANNELS.sessionList, 'data']
  ])
})

// 호스트 채널의 단방향 전송도 그 호스트의 포트로 간다 — 셸 IPC 로 보내면 받는 쪽이 없다(EP-8 · EP-4′).
it('세션 로드 취소는 데이터 포트로 간다 — 셸 IPC 로 보내지 않는다', async () => {
  const api = win.oo as OoApi
  let release!: (value: unknown) => void
  harness.invoke.mockImplementationOnce(() => new Promise((resolve) => (release = resolve)))
  const from = harness.routes.length
  const sentFrom = harness.sent.length
  const pending = api.session.load('s-cancel')
  await vi.waitFor(() =>
    expect(harness.routes.slice(from)).toContainEqual([CHANNELS.sessionHistoryPage, 'data'])
  )
  api.session.cancelLoad('s-cancel')
  expect(harness.routes.slice(from)).toContainEqual([CHANNELS.sessionLoadCancel, 'data'])
  expect(harness.sent.slice(sentFrom).map(([channel]) => channel)).not.toContain(
    CHANNELS.sessionLoadCancel
  )
  release({ cancelled: true })
  await expect(pending).rejects.toThrow()
})

afterAll(() => {
  const wrong = harness.routes.filter(([channel, via]) => ownerOfChannel(channel) !== via)
  expect(wrong).toEqual([])
  expect(new Set(harness.routes.map(([, via]) => via))).toEqual(new Set(['shell', 'agent', 'data']))
})
