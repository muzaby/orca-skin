import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CHANNELS } from '../../../shared/protocol'

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

  it('invalidates settings, runtime config, and catalog after settings CRUD', async () => {
    const invalidateSettings = vi.fn()
    const invalidateRuntime = vi.fn()
    const invalidateCatalog = vi.fn()
    registerEngineHandlers({
      harnessSettings: { invalidateAll: invalidateSettings },
      harnessRuntime: { invalidate: invalidateRuntime },
      runtimeModelCatalog: { isReadOnly: () => false, invalidate: invalidateCatalog }
    } as never)

    await callbacks.get(CHANNELS.engineUpdate)?.({
      key: 'claude-corp',
      settingsJson: '{}'
    } as never)

    expect(invalidateSettings).toHaveBeenCalledOnce()
    expect(invalidateRuntime).toHaveBeenCalledWith(undefined, 'harness-settings-crud')
    expect(invalidateCatalog).toHaveBeenCalledOnce()
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
