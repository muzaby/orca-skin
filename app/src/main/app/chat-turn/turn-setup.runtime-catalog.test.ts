import { describe, expect, it, vi } from 'vitest'
import { createHarnessRuntimeConfigService } from '../../features/harnesses/runtime-config'
import { createRuntimeModelCatalog } from '../../features/harnesses/runtime-catalog'
import { resolveTurnProvider } from './turn-setup'

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

describe('turn setup with the runtime model catalog', () => {
  it('uses the Gate-warmed cache without another augmenter fetch', async () => {
    const fetchContribution = vi.fn(async () => ({
      runtimeEnv: {},
      availableModels: ['claude-sonnet-corp']
    }))
    const runtime = createHarnessRuntimeConfigService({
      settings: { resolve: async () => undefined },
      augmenters: { [contribution.key]: { resolve: fetchContribution } }
    })
    const catalog = createRuntimeModelCatalog({ contributions: [contribution], runtime })
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
        adapter: { id: 'claude' } as never,
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
  })
})
