import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AgentEnvironment } from '../../../shared/ipc'
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

    // AC11 — 같은 인스턴스에서 두 소비처 형태를 비교한다. `agent:list`(무필터, misc.ts:43)와
    // 턴 후보(`adapter` 필터, turn-setup.ts:54)가 같은 runtime key 집합을 봐야 한다.
    const settings: AgentEnvironment[] = [
      { key: 'claude-local', adapter: 'claude', provider: 'local', models: [], supported: true },
      { key: 'claude-corp', adapter: 'claude', provider: 'corp', models: [], supported: true },
      { key: 'other-local', adapter: 'other', provider: 'local', models: [], supported: false }
    ] as AgentEnvironment[]
    const listed = runtimeModelCatalog.merge(settings)
    const candidates = runtimeModelCatalog.merge(settings, 'claude')
    const runtimeKeys = (rows: AgentEnvironment[]): string[] =>
      rows
        .filter((row) => row.source === 'runtime')
        .map((row) => row.key)
        .sort()

    expect(runtimeKeys(listed)).toEqual(['claude-corp'])
    expect(runtimeKeys(candidates)).toEqual(runtimeKeys(listed))
    // adapter 필터는 **양쪽(settings·runtime)에 함께** 걸린다 — 한쪽에만 걸면 두 소비처가 갈린다.
    expect(listed.map((row) => row.key).sort()).toEqual([
      'claude-corp',
      'claude-local',
      'other-local'
    ])
    expect(candidates.map((row) => row.key).sort()).toEqual(['claude-corp', 'claude-local'])
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
