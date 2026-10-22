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
import { CHANNELS, type OpenContextFileResult } from '../shared/ipc'
import type { OrcaApi } from './index'

const harness = vi.hoisted(() => ({
  invoke: vi.fn<(...args: unknown[]) => Promise<unknown>>().mockResolvedValue(undefined),
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

it('carries explicit global extension scope and choices across renderer API and preload', async () => {
  vi.stubGlobal('window', { orca: harness.exposed.get('orca') as OrcaApi })
  try {
    const { sessionApi } = await import('../renderer/src/shared/api/ipc')
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
    await sessionApi.setGlobalExtension(request)
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
    vi.stubGlobal('window', { orca: harness.exposed.get('orca') as OrcaApi })
    try {
      const { engineApi, agentApi } = await import('../renderer/src/shared/api/ipc')
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
  vi.stubGlobal('window', { orca: harness.exposed.get('orca') as OrcaApi })
  try {
    const { engineApi } = await import('../renderer/src/shared/api/ipc')
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
  const api = harness.exposed.get('orca') as OrcaApi
  vi.stubGlobal('window', { orca: api })
  try {
    const { errorApi } = await import('../renderer/src/shared/api/ipc')
    harness.invoke.mockClear()
    await errorApi.revealLog()
    expect(harness.invoke).toHaveBeenCalledExactlyOnceWith('orca:error:revealLog')
    harness.invoke.mockRejectedValueOnce(new Error('folder denied'))
    await expect(errorApi.revealLog()).rejects.toThrow('folder denied')
  } finally {
    vi.unstubAllGlobals()
  }
})

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

it('sends all held inputs now through the renderer API and actual preload using the session key', async () => {
  const api = harness.exposed.get('orca') as OrcaApi
  vi.stubGlobal('window', { orca: api })
  try {
    const { chatApi } = await import('../renderer/src/shared/api/ipc')
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
  const api = harness.exposed.get('orca') as OrcaApi
  vi.stubGlobal('window', { orca: api })
  try {
    const { fileApi } = await import('../renderer/src/shared/api/ipc')
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
      expect(harness.invoke).toHaveBeenLastCalledWith('orca:files:openContextFile', request)
    }
    expect(harness.invoke).toHaveBeenCalledTimes(4)
    harness.invoke.mockRejectedValueOnce(new Error('scope rejected'))
    await expect(fileApi.openContextFile(request)).rejects.toThrow('scope rejected')
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

it('wires DB load and lazy refresh as separate calls with the same stored session ID', async () => {
  vi.stubGlobal('window', { orca: harness.exposed.get('orca') as OrcaApi })
  try {
    const { sessionApi } = await import('../renderer/src/shared/api/ipc')
    const loaded = { id: 'native-session', backend: 'opencode', messages: [] }
    harness.invoke
      .mockClear()
      .mockResolvedValueOnce(loaded)
      .mockResolvedValueOnce({ status: 'unchanged' })
    expect(await sessionApi.load('native-session')).toEqual(loaded)
    expect(harness.invoke).toHaveBeenCalledExactlyOnceWith(CHANNELS.sessionLoad, {
      sessionId: 'native-session'
    })
    expect(await sessionApi.refresh('native-session')).toEqual({ status: 'unchanged' })
    expect(harness.invoke).toHaveBeenLastCalledWith(CHANNELS.sessionRefresh, {
      sessionId: 'native-session'
    })
  } finally {
    harness.invoke.mockResolvedValue(undefined)
    vi.unstubAllGlobals()
  }
})

it('preserves native resource state and toggle identity through renderer and preload', async () => {
  vi.stubGlobal('window', { orca: harness.exposed.get('orca') as OrcaApi })
  try {
    const { sessionApi } = await import('../renderer/src/shared/api/ipc')
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
    await sessionApi.openNativePlugin({ sessionId: 'session-B', id: 'plugin-C' })
    expect(harness.invoke).toHaveBeenLastCalledWith(CHANNELS.sessionOpenNativePlugin, {
      sessionId: 'session-B',
      id: 'plugin-C'
    })
    await sessionApi.openNativePlugin({ sessionId: 'session-B', id: 'mcp-C', kind: 'mcp' })
    expect(harness.invoke).toHaveBeenLastCalledWith(CHANNELS.sessionOpenNativePlugin, {
      sessionId: 'session-B',
      id: 'mcp-C',
      kind: 'mcp'
    })
    await sessionApi.openNativePlugin({ ...draft, id: 'draft-plugin' })
    expect(harness.invoke).toHaveBeenLastCalledWith(CHANNELS.sessionOpenNativePlugin, {
      ...draft,
      id: 'draft-plugin'
    })
    for (const enabled of [false, true]) {
      const request = {
        sessionId: 'session-B',
        generation: 'native-generation',
        kind: 'mcp' as const,
        id: 'server-C',
        enabled
      }
      expect(await sessionApi.setNativeResource(request)).toBe(result)
      expect(harness.invoke).toHaveBeenLastCalledWith(CHANNELS.sessionSetNativeResource, request)
    }
  } finally {
    harness.invoke.mockResolvedValue(undefined)
    vi.unstubAllGlobals()
  }
})
