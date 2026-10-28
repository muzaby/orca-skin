import { EventEmitter } from 'node:events'
import { expect, it, vi } from 'vitest'
import { CHANNELS } from '../../../shared/ipc'
import type { NativeResources } from '../../../shared/native-resources'
import type { GovernedLiveTurn } from '../../contracts/ports'
import type { ProjectResourceSync } from '../project-resource-sync'
const callbacks = vi.hoisted(
  () => new Map<string, (event: unknown, request: unknown) => Promise<NativeResources>>()
)
vi.mock('electron', () => ({
  shell: {},
  ipcMain: {
    handle: (
      name: string,
      callback: (event: unknown, request: unknown) => Promise<NativeResources>
    ) => callbacks.set(name, callback)
  }
}))
import { registerSessionResourceHandlers } from './session-resources'
import { PreparedMcpResources } from '../prepared-mcp-resources'
import { mapManagedMcpResources } from '../../adapters/opencode/v1/managed-mcp'

it('preserves source identity through prepared and live views', async () => {
  const identities = new Map([
    [
      'builtin-alias',
      { kind: 'builtin' as const, sourceId: 'wiki', name: '문서', mentionId: 'wiki' }
    ],
    [
      'user-alias',
      {
        kind: 'user' as const,
        sourceId: 'stored-user',
        name: '사용자 문서',
        mentionId: 'user-alias'
      }
    ]
  ])
  const items = mapManagedMcpResources(
    [...identities.keys()].map((id) => ({
      id,
      name: id,
      kind: 'mcp',
      status: 'connected',
      enabled: true,
      canToggle: false
    })),
    identities
  )
  const release = vi.fn(async () => {})
  const prepared = new PreparedMcpResources({
    scope: () => ({
      backend: 'opencode',
      sessionId: null,
      cwd: 'C:/prepared',
      projectId: null,
      providerKey: 'team-a',
      agentKind: 'code'
    }),
    prepare: async () => ({
      generation: 'prepared-generation',
      signal: new AbortController().signal,
      release,
      read: async () => items as never
    })
  })
  let runtime: GovernedLiveTurn | undefined
  const sync = {
    observe: vi.fn(),
    release: vi.fn(),
    releasePrefix: vi.fn(),
    retry: vi.fn(),
    decorate: (_request: unknown, value: NativeResources) => value
  } as unknown as ProjectResourceSync
  registerSessionResourceHandlers(
    () => runtime,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    sync,
    prepared
  )
  const sender = Object.assign(new EventEmitter(), {
    id: 3,
    isDestroyed: () => false,
    send: vi.fn()
  })
  const invoke = (request: unknown): Promise<NativeResources> =>
    callbacks.get(CHANNELS.sessionNativeResources)!({ sender }, request)
  const scope = {
    backend: 'opencode',
    cwd: 'C:/prepared',
    projectId: null,
    providerKey: 'team-a',
    agentKind: 'code'
  }
  try {
    expect(await invoke({ ...scope, observation: { owner: 'composer', active: true } })).toEqual({
      state: 'disconnected',
      items: []
    })
    expect(await invoke(scope)).toMatchObject({
      state: 'connected',
      generation: 'prepared-generation',
      items: [
        expect.objectContaining({
          managedSource: { kind: 'builtin', sourceId: 'wiki' },
          mentionId: 'wiki'
        }),
        expect.objectContaining({
          managedSource: { kind: 'user', sourceId: 'stored-user' },
          mentionId: 'user-alias'
        })
      ]
    })
    runtime = {
      providerGeneration: 'live-generation',
      nativeResources: async () => ({ state: 'connected', generation: 'live-generation', items })
    } as unknown as GovernedLiveTurn
    expect(await invoke({ sessionId: 'saved' })).toMatchObject({
      generation: 'live-generation',
      items
    })
    let complete!: (value: NativeResources) => void
    runtime.nativeResources = () =>
      new Promise((resolve) => {
        complete = resolve
      })
    const late = invoke({ sessionId: 'saved' })
    const refreshed = expect(late).resolves.toMatchObject({ generation: 'latest', items })
    await Promise.resolve()
    await Promise.resolve()
    prepared.invalidate()
    runtime.nativeResources = async () => ({ state: 'connected', generation: 'latest', items })
    complete({ state: 'connected', generation: 'old', items })
    await refreshed
    const churn = vi.fn(async () => {
      prepared.invalidate()
      return { state: 'connected' as const, generation: 'stale', items }
    })
    runtime.nativeResources = churn
    expect(await invoke({ sessionId: 'saved' })).toEqual({
      state: 'disconnected',
      partial: true,
      configurationPending: true,
      items: []
    })
    expect(churn).toHaveBeenCalledTimes(2)
    sender.emit('render-process-gone')
    expect(await prepared.read(scope as Parameters<typeof prepared.read>[0])).toBeUndefined()
    expect(release).toHaveBeenCalledTimes(1)
  } finally {
    prepared.close()
  }
})
