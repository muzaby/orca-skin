import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CHANNELS } from '../../../shared/protocol'
import { createRuntimeModelCatalog } from '../../features/harnesses/runtime-catalog'
import { createHarnessRuntimeConfigService } from '../../features/harnesses/runtime-config'

const callbacks = vi.hoisted(() => new Map<string, (...args: never[]) => unknown>())

vi.mock('../../infra/ipc/handle', () => ({
  handle: vi.fn((channel: string, _schema: unknown, _mode: unknown, callback: never) => {
    callbacks.set(channel, callback)
  }),
  handlePlain: vi.fn()
}))
vi.mock('../../features/extensions/deployer', () => ({
  deploy: vi.fn(async () => ({ validation: { ok: true, errors: [] } }))
}))
vi.mock('../../features/harnesses/settings-write', () => ({
  addHarnessSettings: vi.fn(() => ({})),
  deleteHarnessSettings: vi.fn(),
  readHarnessSettings: vi.fn(() => ({})),
  updateHarnessSettings: vi.fn(() => ({}))
}))
vi.mock('../../adapters/claude-settings', () => ({ readUserClaudeSettings: vi.fn() }))
vi.mock('../../infra/log', () => ({
  getLogger: () => ({ child: () => ({ warn: vi.fn() }) })
}))

const { registerEngineHandlers } = await import('./engine')

describe('engine runtime catalog invalidation wiring', () => {
  beforeEach(() => callbacks.clear())

  it.each([
    [CHANNELS.engineAdd, { engine: 'claude', provider: ' Corp ', settingsJson: '{}' }],
    [CHANNELS.engineUpdate, { key: ' CLAUDE-Corp ', settingsJson: '{}' }],
    [CHANNELS.engineDelete, { key: ' CLAUDE-Corp ' }]
  ])('invalidates only the canonical edited key after %s', async (channel, request) => {
    const invalidateSettings = vi.fn()
    const invalidateRuntime = vi.fn()
    const invalidateCatalog = vi.fn()
    registerEngineHandlers({
      harnessSettings: { invalidateAll: invalidateSettings },
      harnessRuntime: { invalidate: invalidateRuntime },
      runtimeModelCatalog: { isReadOnly: () => false, invalidate: invalidateCatalog }
    } as never)

    await callbacks.get(channel)?.(request as never)

    expect(invalidateSettings).toHaveBeenCalledOnce()
    expect(invalidateRuntime).toHaveBeenCalledWith('claude-corp', 'harness-settings-crud')
    expect(invalidateCatalog).toHaveBeenCalledWith('claude-corp')
  })

  it.each([
    [CHANNELS.engineAdd, { engine: 'claude', provider: 'local', settingsJson: '{}' }],
    [CHANNELS.engineUpdate, { key: 'claude-local', settingsJson: '{}' }],
    [CHANNELS.engineDelete, { key: 'claude-local' }]
  ])('preserves a different runtime contribution after %s', async (channel, request) => {
    const runtime = createHarnessRuntimeConfigService({
      settings: { resolve: async () => undefined },
      augmenters: {
        'claude-corp': {
          resolve: async () => ({
            runtimeEnv: {},
            availableModels: ['corp-model']
          })
        }
      }
    })
    const runtimeModelCatalog = createRuntimeModelCatalog({
      contributions: [
        { authId: 'gate', key: 'claude-corp', harnessId: 'claude', modelProviderId: 'corp' }
      ],
      snapshotOf: () => ({
        authId: 'gate',
        status: 'valid',
        verified: true,
        credentialRevision: 1
      }),
      runtime
    })
    await runtimeModelCatalog.reconcile('gate', {
      authId: 'gate',
      status: 'valid',
      verified: true,
      credentialRevision: 1
    })
    registerEngineHandlers({
      harnessSettings: { invalidateAll: vi.fn() },
      harnessRuntime: runtime,
      runtimeModelCatalog
    } as never)

    await callbacks.get(channel)?.(request as never)

    expect(runtimeModelCatalog.list().map((entry) => entry.key)).toEqual(['claude-corp'])
    expect(runtime.cached('claude-corp')).toBeDefined()
  })

  it.each([
    [CHANNELS.engineUpdate, { key: 'claude-  CORP', settingsJson: '{}' }],
    [CHANNELS.engineDelete, { key: 'claude-  CORP' }],
    [CHANNELS.engineRead, { key: 'claude-  CORP' }]
  ])('rejects non-canonical runtime-managed keys on %s', async (channel, request) => {
    const isReadOnly = vi.fn((key: string) => key === 'claude-corp')
    registerEngineHandlers({
      harnessSettings: { invalidateAll: vi.fn() },
      runtimeModelCatalog: { isReadOnly, invalidate: vi.fn() }
    } as never)

    await expect(async () => callbacks.get(channel)?.(request as never)).rejects.toThrow(
      'runtime-managed engine is read-only: claude-corp'
    )
    expect(isReadOnly).toHaveBeenCalledWith('claude-corp')
  })
})
