import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AgentEnvironment } from '../../../shared/ipc'
import { CHANNELS } from '../../../shared/protocol'
import { mergeAgentEnvironments } from '../../features/harnesses/models'

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

const isRuntimeManaged = (key: string): boolean => key.trim().toLowerCase() === 'shared'

describe('agent:list runtime catalog wiring', () => {
  beforeEach(() => callbacks.clear())

  it('uses the runtime catalog to hide a colliding settings row', () => {
    registerMiscHandlers({
      registry: {
        list: () => [{ id: 'claude' }],
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
      runtimeModelCatalog: {
        list: () => [],
        isReadOnly: isRuntimeManaged,
        merge: (settings: AgentEnvironment[]) =>
          mergeAgentEnvironments(settings, [], isRuntimeManaged)
      },
      debugMock: { log: false }
    } as never)

    expect(callbacks.get(CHANNELS.agentList)?.()).toEqual([
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
})
