import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CHANNELS } from '../../../shared/protocol'
import { createRuntimeModelCatalog } from '../../features/harnesses/common/runtime-catalog'

const callbacks = vi.hoisted(() => new Map<string, () => unknown>())

vi.mock('../../infra/ipc/handle', () => ({
  handle: vi.fn(),
  handlePlain: vi.fn((channel: string, callback: () => unknown) => callbacks.set(channel, callback))
}))
vi.mock('electron', () => ({ BrowserWindow: {}, Notification: {} }))
vi.mock('../../infra/ipc/send', () => ({ sendInstallStatus: vi.fn(), setWireLog: vi.fn() }))
vi.mock('../../infra/ipc/wire-log', () => ({ setWireSink: vi.fn() }))
vi.mock('../../infra/log', () => ({
  getLogger: () => ({ child: () => ({ debug: vi.fn() }) }),
  setConsoleMirror: vi.fn()
}))
vi.mock('../../infra/config/orca-config', () => ({
  getOrcaConfig: () => ({}),
  appEnv: () => ({ XDG_DATA_HOME: 'C:/native/data' })
}))

const { registerMiscHandlers } = await import('./misc')

describe('agent:list runtime catalog wiring', () => {
  beforeEach(() => callbacks.clear())

  it('uses the runtime catalog to hide a colliding settings row', async () => {
    registerMiscHandlers({
      registry: {
        list: () => [{ id: 'claude' }],
        get: () => null,
        describeAll: () => ({}),
        getActiveId: () => null
      },
      harnessSettings: {
        adapters: () => ['claude'],
        list: () => [
          { key: ' Shared ', harness: 'claude', name: 'Settings', models: [] },
          { key: 'local', harness: 'claude', name: 'Local', models: [] }
        ]
      },
      runtimeModelCatalog: createRuntimeModelCatalog({
        parseModels: parseHarnessRuntimeModels,
        contributions: [
          { authId: 'claude', key: 'shared', harnessId: 'claude', modelProviderId: 'claude' }
        ],
        snapshotOf: () =>
          ({ authId: 'claude', status: 'valid', verified: true, credentialRevision: 1 }) as never,
        runtime: { resolve: vi.fn() } as never
      }),
      debugMock: { log: false }
    } as never)

    expect(await callbacks.get(CHANNELS.agentList)?.()).toEqual([
      {
        adapter: undefined,
        key: 'local',
        models: [],
        provider: undefined,
        readOnly: false,
        source: 'settings',
        supported: false
      }
    ])
  })

  it('loads native OpenCode models and preserves other harness rows when its catalog fails', async () => {
    const catalog = vi.fn(async (entry) => ({
      ...entry,
      models: [{ alias: 'Native model', model: 'native/model' }]
    }))
    const resolve = vi.fn(async () => ({ settings: { model: 'native/model' } }))
    registerMiscHandlers({
      registry: {
        list: () => [{ id: 'claude' }, { id: 'opencode' }],
        get: (id: string) => (id === 'opencode' ? { catalog, agentSpawnEnv: () => ({}) } : null)
      },
      harnessSettings: {
        adapters: () => ['claude', 'opencode'],
        list: (adapter: string) => [
          { key: `${adapter}-local`, harnessId: adapter, modelProviderId: 'local', models: [] }
        ],
        resolve
      },
      debugMock: { log: false },
      mcp: { resolver: () => () => undefined }
    } as never)
    const first = (await callbacks.get(CHANNELS.agentList)?.()) as Array<{
      adapter: string
      models: unknown[]
      catalogError?: string
    }>
    expect(first.find((entry) => entry.adapter === 'opencode')?.models).toEqual([
      { alias: 'Native model', model: 'native/model' }
    ])
    expect(catalog).toHaveBeenCalledWith(
      expect.objectContaining({ key: 'opencode-local' }),
      { model: 'native/model' },
      true,
      expect.objectContaining({ XDG_DATA_HOME: 'C:/native/data' })
    )
    expect(resolve).toHaveBeenCalledWith({
      key: 'opencode-local',
      harnessId: 'opencode',
      modelProviderId: 'local'
    })
    catalog.mockRejectedValueOnce(new Error('catalog unavailable'))
    const failed = (await callbacks.get(CHANNELS.agentList)?.()) as typeof first
    expect(failed.find((entry) => entry.adapter === 'opencode')?.catalogError).toBe(
      'catalog unavailable'
    )
    expect(failed.find((entry) => entry.adapter === 'claude')?.catalogError).toBeUndefined()
  })
})

import { parseHarnessRuntimeModels } from '../harnesses/registry'
import { openCodeCatalog } from '../../adapters/opencode/v1/catalog'

// 0291 EP-06 ③ — OpenCode runtime 행은 runtime 모델과 primary agents 를 함께 유지한다.
describe('agent:list OpenCode runtime rows (0291)', () => {
  beforeEach(() => callbacks.clear())

  it('agent:list keeps OpenCode runtime models and primary agents', async () => {
    const contribution = {
      authId: 'opencode-llm',
      key: 'opencode-corp',
      harnessId: 'opencode',
      modelProviderId: 'corp'
    }
    const config = {
      key: 'opencode-corp',
      harnessId: 'opencode',
      modelProviderId: 'corp',
      runtimeEnv: {},
      settings: {
        providerKey: 'opencode-corp',
        provider: 'corp',
        settings: {},
        sourceRevision: 'x'
      },
      availableModels: ['corp/a'],
      modelDetails: { 'corp/a': { name: 'A 모델', variants: ['high'] } }
    }
    const runtime = {
      resolve: vi.fn(async () => config),
      cached: vi.fn(() => config),
      invalidate: vi.fn()
    }
    const catalog = createRuntimeModelCatalog({
      parseModels: parseHarnessRuntimeModels,
      contributions: [contribution],
      snapshotOf: () =>
        ({
          authId: 'opencode-llm',
          status: 'valid',
          verified: true,
          credentialRevision: 1
        }) as never,
      runtime: runtime as never
    })
    await catalog.reconcile('opencode-llm', {
      authId: 'opencode-llm',
      status: 'valid',
      verified: true,
      credentialRevision: 1
    })
    registerMiscHandlers({
      registry: {
        list: () => [{ id: 'claude' }, { id: 'opencode' }],
        get: (id: string) =>
          id === 'opencode'
            ? {
                catalog: async (entry: never, settings: Record<string, unknown>) =>
                  openCodeCatalog(entry, settings),
                agentSpawnEnv: () => ({})
              }
            : null
      },
      harnessSettings: { adapters: () => [], list: () => [] },
      runtimeModelCatalog: catalog,
      harnessRuntime: runtime,
      debugMock: { log: false },
      mcp: { resolver: () => () => undefined }
    } as never)
    const rows = (await callbacks.get(CHANNELS.agentList)?.()) as Array<Record<string, unknown>>
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      key: 'opencode-corp',
      adapter: 'opencode',
      source: 'runtime',
      readOnly: true,
      agents: [{ name: 'build' }, { name: 'plan' }]
    })
    expect(rows[0]!.models).toEqual([
      expect.objectContaining({ model: 'corp/a', alias: 'A 모델', variants: ['high'] })
    ])
    expect(rows[0]).not.toHaveProperty('catalogError')
    expect(runtime.resolve).toHaveBeenCalledTimes(1)
  })
})
