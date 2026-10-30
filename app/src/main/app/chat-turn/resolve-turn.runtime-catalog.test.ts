import { describe, expect, it, vi } from 'vitest'
import { createHarnessRuntimeConfigService } from '../../features/harnesses/common/runtime-config'
import { createRuntimeModelCatalog } from '../../features/harnesses/common/runtime-catalog'
import { resolveTurnProvider } from './resolve-turn'
import type { AgentKind } from '../../../shared/agent-kind'
import type { AdapterSpawnEnvPatch } from '../../adapters/common/harness-config'

vi.mock('../../infra/ipc/send', () => ({ sendChatEvent: vi.fn() }))
vi.mock('../../infra/log', () => ({
  getLogger: () => ({ child: () => ({ warn: vi.fn() }) })
}))
vi.mock('../../infra/config/orca-config', () => ({ appEnv: () => ({}) }))

const contribution = {
  authId: 'gate',
  key: 'claude-corp',
  harnessId: 'claude',
  modelProviderId: 'corp'
}

function adapter(
  agentSpawnEnv: (agentKind: AgentKind) => AdapterSpawnEnvPatch = vi.fn(() => ({}))
): { id: 'claude'; agentSpawnEnv: (agentKind: AgentKind) => AdapterSpawnEnvPatch } {
  return { id: 'claude' as const, agentSpawnEnv }
}

describe('turn setup with the runtime model catalog', () => {
  it('passes the prepared native environment to catalog and execution unchanged', async () => {
    const catalog = vi.fn(async (entry) => ({ ...entry, models: [] }))
    const resolved = await resolveTurnProvider(
      {
        harnessSettings: {
          list: () => [
            { key: 'opencode-local', harnessId: 'opencode', modelProviderId: 'local', models: [] }
          ]
        },
        harnessRuntime: {
          resolve: async () => ({
            key: 'opencode-local',
            harnessId: 'opencode',
            modelProviderId: 'local',
            settings: { settings: { model: 'native/model' } },
            runtimeEnv: { XDG_DATA_HOME: 'C:/native/custom' }
          })
        },
        db: { getSessionById: () => undefined },
        mcp: { resolver: () => () => undefined }
      } as never,
      {
        adapter: { id: 'opencode', catalog, agentSpawnEnv: () => ({}) } as never,
        agentKind: 'code',
        sessionId: null,
        providerKey: 'opencode-local',
        modelFamily: null
      }
    )
    expect(catalog).toHaveBeenCalledWith(
      expect.objectContaining({ key: 'opencode-local' }),
      { model: 'native/model' },
      false,
      resolved.prepared.env
    )
    expect(resolved.prepared.env?.XDG_DATA_HOME).toBe('C:/native/custom')
  })

  it('uses the Gate-warmed cache without another augmenter fetch', async () => {
    let now = 0
    const fetchContribution = vi.fn(async () => ({
      runtimeEnv: {},
      availableModels: ['claude-sonnet-corp'],
      validUntil: 60_000
    }))
    const runtime = createHarnessRuntimeConfigService({
      settings: { resolve: async () => undefined },
      augmenters: { [contribution.key]: { resolve: fetchContribution } },
      clock: () => now
    })
    const catalog = createRuntimeModelCatalog({
      parseModels: parseHarnessRuntimeModels,
      contributions: [contribution],
      snapshotOf: () =>
        ({ authId: 'gate', status: 'valid', verified: true, credentialRevision: 1 }) as never,
      runtime
    })
    await catalog.reconcile('gate', {
      authId: 'gate',
      status: 'valid',
      verified: true,
      credentialRevision: 1
    })

    const resolved = await resolveTurnProvider(
      {
        harnessSettings: { list: () => [] },
        runtimeModelCatalog: catalog,
        harnessRuntime: runtime,
        db: { getSessionById: () => undefined },
        mcp: { resolver: () => () => undefined }
      } as never,
      {
        adapter: adapter(),
        agentKind: 'code',
        sessionId: null,
        providerKey: contribution.key,
        modelFamily: 'claude-sonnet-corp'
      }
    )

    expect(resolved).toMatchObject({
      providerKey: contribution.key,
      model: 'claude-sonnet-corp'
    })
    expect(fetchContribution).toHaveBeenCalledTimes(1)

    now = 120_000
    await resolveTurnProvider(
      {
        harnessSettings: { list: () => [] },
        runtimeModelCatalog: catalog,
        harnessRuntime: runtime,
        db: { getSessionById: () => undefined },
        mcp: { resolver: () => () => undefined }
      } as never,
      {
        adapter: adapter(),
        agentKind: 'code',
        sessionId: null,
        providerKey: contribution.key,
        modelFamily: 'claude-sonnet-corp'
      }
    )
    expect(fetchContribution).toHaveBeenCalledTimes(1)
  })

  it('uses the runtime row for execution when a settings key collides', async () => {
    const runtime = createHarnessRuntimeConfigService({
      settings: { resolve: async () => undefined },
      augmenters: {
        [contribution.key]: {
          resolve: async () => ({ runtimeEnv: {}, availableModels: ['runtime-model'] })
        }
      }
    })
    const catalog = createRuntimeModelCatalog({
      parseModels: parseHarnessRuntimeModels,
      contributions: [contribution],
      snapshotOf: () =>
        ({ authId: 'gate', status: 'valid', verified: true, credentialRevision: 1 }) as never,
      runtime
    })
    await catalog.reconcile('gate', {
      authId: 'gate',
      status: 'valid',
      verified: true,
      credentialRevision: 1
    })

    const resolved = await resolveTurnProvider(
      {
        harnessSettings: {
          list: () => [
            {
              key: contribution.key,
              harnessId: 'claude',
              modelProviderId: 'corp',
              models: [
                {
                  alias: 'custom',
                  model: 'settings-model',
                  isCustom: true,
                  oneMillionContext: false,
                  isDefault: true
                }
              ]
            }
          ]
        },
        runtimeModelCatalog: catalog,
        harnessRuntime: runtime,
        db: { getSessionById: () => undefined },
        mcp: { resolver: () => () => undefined }
      } as never,
      {
        adapter: adapter(),
        agentKind: 'code',
        sessionId: null,
        providerKey: contribution.key,
        modelFamily: 'runtime-model'
      }
    )

    expect(resolved.model).toBe('runtime-model')
  })

  it('does not execute a colliding settings row after runtime invalidation', async () => {
    const runtime = createHarnessRuntimeConfigService({
      settings: { resolve: async () => undefined },
      augmenters: { [contribution.key]: { resolve: async () => ({ runtimeEnv: {} }) } }
    })
    const catalog = createRuntimeModelCatalog({
      parseModels: parseHarnessRuntimeModels,
      contributions: [contribution],
      snapshotOf: () =>
        ({ authId: 'gate', status: 'valid', verified: true, credentialRevision: 1 }) as never,
      runtime
    })

    const resolved = await resolveTurnProvider(
      {
        harnessSettings: {
          list: () => [
            {
              key: ' CLAUDE-CORP ',
              harnessId: 'claude',
              modelProviderId: 'corp',
              models: []
            }
          ]
        },
        runtimeModelCatalog: catalog,
        harnessRuntime: runtime,
        db: { getSessionById: () => undefined },
        mcp: { resolver: () => () => undefined }
      } as never,
      {
        adapter: adapter(),
        agentKind: 'code',
        sessionId: null,
        providerKey: contribution.key,
        modelFamily: null
      }
    )

    expect(resolved.providerKey).toBeNull()
  })

  it.each([
    ['resolved', true],
    ['unresolved', false]
  ] as const)('applies one adapter policy snapshot to the %s branch', async (_branch, resolved) => {
    const agentSpawnEnv = vi.fn((agentKind: 'code' | 'work') => ({ SESSION_KIND: agentKind }))
    const result = await resolveTurnProvider(
      {
        harnessSettings: {
          list: () =>
            resolved
              ? [
                  {
                    key: 'claude-local',
                    harnessId: 'claude',
                    modelProviderId: 'local',
                    models: []
                  }
                ]
              : []
        },
        db: { getSessionById: () => undefined },
        mcp: { resolver: () => () => undefined }
      } as never,
      {
        adapter: adapter(agentSpawnEnv),
        agentKind: 'work',
        sessionId: null,
        providerKey: null,
        modelFamily: null
      }
    )

    expect(agentSpawnEnv).toHaveBeenCalledOnce()
    expect(agentSpawnEnv).toHaveBeenCalledWith('work')
    expect(result.prepared.env?.SESSION_KIND).toBe('work')
    expect(result.prepared.runtimeEnvFingerprint === undefined).toBe(!resolved)
  })
})

import { parseHarnessRuntimeModels } from '../harnesses/registry'
import { openCodeCatalog } from '../../adapters/opencode/v1/catalog'

// 0291 — OpenCode runtime 키(호스트 설정 그대로)의 턴은 merged runtime 행을 catalog 에 넘겨
// 선택 runtime 모델로 실행한다. settings.json 이 없으므로 settings 는 `{}` 이다.
describe('OpenCode runtime catalog turns (0291 EP-06)', () => {
  it('OpenCode runtime key runs the selected runtime model with host settings', async () => {
    const opencode = {
      authId: 'opencode-llm',
      key: 'opencode-corp',
      harnessId: 'opencode',
      modelProviderId: 'corp'
    }
    const runtime = createHarnessRuntimeConfigService({
      settings: {
        resolve: async () => ({
          providerKey: 'opencode-corp',
          provider: 'corp',
          settings: {},
          sourceRevision: 'missing'
        })
      },
      augmenters: {
        [opencode.key]: {
          resolve: async () => ({
            runtimeEnv: {},
            availableModels: ['corp/a', 'corp/b'],
            modelDetails: { 'corp/b': { name: 'B 모델', variants: ['high'] } }
          })
        }
      }
    })
    const catalog = createRuntimeModelCatalog({
      parseModels: parseHarnessRuntimeModels,
      contributions: [opencode],
      snapshotOf: () =>
        ({
          authId: 'opencode-llm',
          status: 'valid',
          verified: true,
          credentialRevision: 1
        }) as never,
      runtime
    })
    await catalog.reconcile('opencode-llm', {
      authId: 'opencode-llm',
      status: 'valid',
      verified: true,
      credentialRevision: 1
    })
    const adapterCatalog = vi.fn(async (entry, config) => openCodeCatalog(entry, config))
    const resolved = await resolveTurnProvider(
      {
        harnessSettings: { list: () => [] },
        runtimeModelCatalog: catalog,
        harnessRuntime: runtime,
        db: { getSessionById: () => undefined },
        mcp: { resolver: () => () => undefined }
      } as never,
      {
        adapter: { id: 'opencode', catalog: adapterCatalog, agentSpawnEnv: () => ({}) } as never,
        agentKind: 'code',
        sessionId: null,
        providerKey: opencode.key,
        modelFamily: 'corp/b'
      }
    )
    expect(adapterCatalog).toHaveBeenCalledOnce()
    expect(adapterCatalog.mock.calls[0]![0]).toMatchObject({ source: 'runtime', readOnly: true })
    expect(adapterCatalog.mock.calls[0]![1]).toEqual({})
    expect(resolved).toMatchObject({ providerKey: opencode.key, model: 'corp/b' })
  })
})
