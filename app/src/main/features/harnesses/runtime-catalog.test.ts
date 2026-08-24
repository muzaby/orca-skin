import { describe, expect, it, vi } from 'vitest'
import { createRuntimeModelCatalog } from './runtime-catalog'
import { createHarnessRuntimeConfigService } from './runtime-config'
import type { AuthSnapshot } from '../../contracts/auth'
import type { HarnessRuntimeConfig } from '../../adapters/harness-config'

const contribution = {
  authId: 'gate',
  key: 'orca-corp',
  harnessId: 'orca',
  modelProviderId: 'corp'
}
const config = (models: string[]): HarnessRuntimeConfig => ({
  key: contribution.key,
  harnessId: contribution.harnessId,
  modelProviderId: contribution.modelProviderId,
  runtimeEnv: {},
  availableModels: models
})

const valid = (revision = 1): AuthSnapshot => ({
  authId: 'gate',
  status: 'valid' as const,
  verified: true,
  credentialRevision: revision
})

describe('runtime model catalog', () => {
  it('fetches once per verified revision and serves subsequent reads from memory', async () => {
    const resolve = vi.fn(async () => config(['corp-model']))
    const catalog = createRuntimeModelCatalog({
      contributions: [contribution],
      runtime: { resolve, invalidate: vi.fn() }
    })
    await catalog.reconcile('gate', valid())
    await catalog.reconcile('gate', valid())
    expect(resolve).toHaveBeenCalledTimes(1)
    expect(catalog.list()).toEqual([
      expect.objectContaining({ key: 'orca-corp', readOnly: true, source: 'runtime' })
    ])
    expect(catalog.list()[0].models[0]).toMatchObject({
      alias: 'corp-model',
      model: 'corp-model'
    })
  })

  it('coalesces concurrent verified events into one fetch', async () => {
    let release!: (value: HarnessRuntimeConfig) => void
    const resolve = vi.fn(() => new Promise<HarnessRuntimeConfig>((done) => (release = done)))
    const catalog = createRuntimeModelCatalog({
      contributions: [contribution],
      runtime: { resolve, invalidate: vi.fn() }
    })
    const first = catalog.reconcile('gate', valid())
    const second = catalog.reconcile('gate', valid())
    release(config(['sonnet-corp']))
    await Promise.all([first, second])
    expect(resolve).toHaveBeenCalledTimes(1)
  })

  it('removes on unusable auth and rejects a late success', async () => {
    let release!: (value: HarnessRuntimeConfig) => void
    const resolve = vi.fn(() => new Promise<HarnessRuntimeConfig>((done) => (release = done)))
    const catalog = createRuntimeModelCatalog({
      contributions: [contribution],
      runtime: { resolve, invalidate: vi.fn() }
    })
    const pending = catalog.reconcile('gate', valid())
    await catalog.reconcile('gate', { ...valid(), status: 'none', verified: false })
    release(config(['late']))
    await pending
    expect(catalog.list()).toEqual([])
  })

  it('refetches once for a new credential revision', async () => {
    const resolve = vi.fn(async () => config(['custom']))
    const catalog = createRuntimeModelCatalog({
      contributions: [contribution],
      runtime: { resolve, invalidate: vi.fn() }
    })
    await catalog.reconcile('gate', valid(1))
    await catalog.reconcile('gate', valid(2))
    expect(resolve).toHaveBeenCalledTimes(2)
  })

  it('warms the shared runtime cache so later session and turn resolves do not fetch', async () => {
    const fetchContribution = vi.fn(async () => config(['orca-private-v1']))
    const runtime = createHarnessRuntimeConfigService({
      settings: { resolve: async () => undefined },
      augmenters: { [contribution.key]: { resolve: fetchContribution } }
    })
    const catalog = createRuntimeModelCatalog({ contributions: [contribution], runtime })

    await catalog.reconcile('gate', valid())
    await runtime.resolve(contribution)
    await runtime.resolve(contribution)

    expect(fetchContribution).toHaveBeenCalledTimes(1)
  })
})
