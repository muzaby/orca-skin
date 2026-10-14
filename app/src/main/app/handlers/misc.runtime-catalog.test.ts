import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CHANNELS } from '../../../shared/protocol'
import { createRuntimeModelCatalog } from '../../features/harnesses/runtime-catalog'

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
vi.mock('../../infra/config/orca-config', () => ({ getOrcaConfig: () => ({}) }))

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
        get: (id: string) => (id === 'opencode' ? { catalog } : null)
      },
      harnessSettings: {
        adapters: () => ['claude', 'opencode'],
        list: (adapter: string) => [
          { key: `${adapter}-local`, harnessId: adapter, modelProviderId: 'local', models: [] }
        ],
        resolve
      },
      debugMock: { log: false }
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
      true
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
