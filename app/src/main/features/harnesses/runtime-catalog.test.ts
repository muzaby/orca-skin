import { describe, expect, it, vi } from 'vitest'
import { createRuntimeModelCatalog, createRuntimeModelCatalogBridge } from './runtime-catalog'
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
  it('filters both settings and runtime rows to the requested adapter', () => {
    const catalog = createRuntimeModelCatalog({
      contributions: [],
      snapshotOf: () => valid(),
      runtime: { resolve: vi.fn(), cached: vi.fn(), invalidate: vi.fn() }
    })

    expect(
      catalog.merge(
        [
          { key: 'orca-local', adapter: 'orca', models: [], supported: false },
          { key: 'other-local', adapter: 'other', models: [], supported: false }
        ],
        'orca'
      )
    ).toEqual([{ key: 'orca-local', adapter: 'orca', models: [], supported: false }])
  })

  it('replays an auth-resume snapshot that arrived before bootstrap attached the catalog', async () => {
    const reconcile = vi.fn(async () => undefined)
    const snapshotOf = vi.fn(() => valid(0))
    const bridge = createRuntimeModelCatalogBridge({ contributions: [contribution], snapshotOf })

    await bridge.onSnapshot('gate', valid(3))
    await bridge.attach({
      list: () => [],
      isReadOnly: () => true,
      merge: (settings) => settings,
      invalidate: vi.fn(),
      reconcile
    })

    expect(reconcile).toHaveBeenCalledOnce()
    expect(reconcile).toHaveBeenCalledWith('gate', valid(3))
    expect(snapshotOf).not.toHaveBeenCalled()
  })

  it('catches up from the current auth snapshot when no earlier event arrived', async () => {
    const reconcile = vi.fn(async () => undefined)
    const snapshotOf = vi.fn(() => valid(4))
    const bridge = createRuntimeModelCatalogBridge({ contributions: [contribution], snapshotOf })

    await bridge.attach({
      list: () => [],
      isReadOnly: () => true,
      merge: (settings) => settings,
      invalidate: vi.fn(),
      reconcile
    })

    expect(reconcile).toHaveBeenCalledWith('gate', valid(4))
  })

  it('fetches once per verified revision and serves subsequent reads from memory', async () => {
    const resolve = vi.fn(async () => config(['corp-model']))
    const catalog = createRuntimeModelCatalog({
      contributions: [contribution],
      snapshotOf: () => valid(),
      runtime: { resolve, cached: vi.fn(), invalidate: vi.fn() }
    })
    await catalog.reconcile('gate', valid())
    await catalog.reconcile('gate', valid())
    expect(resolve).toHaveBeenCalledTimes(1)
    expect(catalog.list()).toEqual([
      expect.objectContaining({ key: 'orca-corp', readOnly: true, source: 'runtime' })
    ])
    expect(catalog.list()[0].models[0]).toMatchObject({
      alias: 'custom',
      model: 'corp-model'
    })
  })

  it('coalesces concurrent verified events into one fetch', async () => {
    let release!: (value: HarnessRuntimeConfig) => void
    const resolve = vi.fn(() => new Promise<HarnessRuntimeConfig>((done) => (release = done)))
    const catalog = createRuntimeModelCatalog({
      contributions: [contribution],
      snapshotOf: () => valid(),
      runtime: { resolve, cached: vi.fn(), invalidate: vi.fn() }
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
      snapshotOf: () => valid(),
      runtime: { resolve, cached: vi.fn(), invalidate: vi.fn() }
    })
    const pending = catalog.reconcile('gate', valid())
    await catalog.reconcile('gate', { ...valid(), status: 'none', verified: false })
    release(config(['late']))
    await pending
    expect(catalog.list()).toEqual([])
  })

  it.each(['expired', 'unknown'] as const)(
    'removes a verified entry when auth status becomes %s',
    async (status) => {
      const catalog = createRuntimeModelCatalog({
        contributions: [contribution],
        snapshotOf: () => valid(),
        runtime: {
          resolve: vi.fn(async () => config(['sonnet-corp'])),
          cached: vi.fn(),
          invalidate: vi.fn()
        }
      })
      await catalog.reconcile('gate', valid())
      await catalog.reconcile('gate', { ...valid(), status })
      expect(catalog.list()).toEqual([])
    }
  )

  it('refetches once for a new credential revision', async () => {
    const resolve = vi.fn(async () => config(['custom']))
    const catalog = createRuntimeModelCatalog({
      contributions: [contribution],
      snapshotOf: () => valid(),
      runtime: { resolve, cached: vi.fn(), invalidate: vi.fn() }
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
    const catalog = createRuntimeModelCatalog({
      contributions: [contribution],
      snapshotOf: () => valid(),
      runtime
    })

    await catalog.reconcile('gate', valid())
    await runtime.resolve(contribution)
    await runtime.resolve(contribution)

    expect(fetchContribution).toHaveBeenCalledTimes(1)
  })

  it('rejects non-array availableModels at the runtime boundary', async () => {
    const resolve = vi.fn(async () => ({ ...config([]), availableModels: 'abc' as never }))
    const catalog = createRuntimeModelCatalog({
      contributions: [contribution],
      snapshotOf: () => valid(),
      runtime: { resolve, cached: vi.fn(), invalidate: vi.fn() }
    })

    await catalog.reconcile('gate', valid())

    expect(catalog.list()).toEqual([])
  })

  it('removes only the failing contribution when a fetch rejects', async () => {
    const other = { ...contribution, key: 'orca-other', modelProviderId: 'other' }
    const resolve = vi.fn(async (item: typeof contribution) => {
      if (item.key === contribution.key) throw new Error('offline')
      return { ...config(['sonnet-other']), key: other.key, modelProviderId: other.modelProviderId }
    })
    const catalog = createRuntimeModelCatalog({
      contributions: [contribution, other],
      snapshotOf: () => valid(),
      runtime: { resolve, cached: vi.fn(), invalidate: vi.fn() }
    })

    await catalog.reconcile('gate', valid())

    expect(catalog.list().map((entry) => entry.key)).toEqual(['orca-other'])
  })

  it('treats declared runtime keys as read-only across casing and whitespace variants', () => {
    const catalog = createRuntimeModelCatalog({
      contributions: [contribution],
      snapshotOf: () => valid(),
      runtime: { resolve: vi.fn(), cached: vi.fn(), invalidate: vi.fn() }
    })

    expect(catalog.isReadOnly(' orca-CORP ')).toBe(true)
  })

  it('replays a valid snapshot inside the same invalidation', async () => {
    const resolve = vi.fn(async () => config(['corp-model']))
    const onChange = vi.fn()
    const catalog = createRuntimeModelCatalog({
      contributions: [contribution],
      snapshotOf: () => valid(),
      runtime: { resolve, cached: vi.fn(), invalidate: vi.fn() },
      onChange
    })
    await catalog.reconcile('gate', valid())

    await catalog.invalidate(' ORCA-corp ')
    expect(resolve).toHaveBeenCalledTimes(2)
    expect(catalog.list()).toHaveLength(1)
    expect(onChange).toHaveBeenCalledTimes(3)
  })

  it('invalidates only the requested canonical contribution key', async () => {
    const other = { ...contribution, key: 'orca-other', modelProviderId: 'other' }
    const catalog = createRuntimeModelCatalog({
      contributions: [contribution, other],
      snapshotOf: () => valid(),
      runtime: {
        resolve: vi.fn(async (item: typeof contribution) => ({
          ...config([`${item.modelProviderId}-model`]),
          key: item.key,
          modelProviderId: item.modelProviderId
        })),
        cached: vi.fn(),
        invalidate: vi.fn()
      }
    })
    await catalog.reconcile('gate', valid())

    await catalog.invalidate(' ORCA-CORP ')

    expect(catalog.list().map((entry) => entry.key)).toEqual(['orca-corp', 'orca-other'])
  })

  it('replays every contribution during a full invalidation', async () => {
    const other = { ...contribution, authId: 'other-auth', key: 'orca-other' }
    const snapshots: Record<string, AuthSnapshot> = {
      gate: valid(),
      'other-auth': { ...valid(), authId: 'other-auth' }
    }
    const resolve = vi.fn(async (item: typeof contribution) => ({
      ...config([`${item.key}-model`]),
      key: item.key,
      modelProviderId: item.modelProviderId
    }))
    const catalog = createRuntimeModelCatalog({
      contributions: [contribution, other],
      snapshotOf: (authId) => snapshots[authId],
      runtime: { resolve, cached: vi.fn(), invalidate: vi.fn() }
    })
    await Promise.all([
      catalog.reconcile('gate', valid()),
      catalog.reconcile('other-auth', snapshots['other-auth'])
    ])

    await catalog.invalidate()

    expect(resolve).toHaveBeenCalledTimes(4)
    expect(catalog.list().map((entry) => entry.key)).toEqual(['orca-corp', 'orca-other'])
  })

  it('starts a latest-generation replay instead of joining stale in-flight work', async () => {
    let releaseFirst!: (value: HarnessRuntimeConfig) => void
    const resolve = vi
      .fn()
      .mockImplementationOnce(
        () => new Promise<HarnessRuntimeConfig>((done) => (releaseFirst = done))
      )
      .mockResolvedValueOnce(config(['latest-model']))
    const catalog = createRuntimeModelCatalog({
      contributions: [contribution],
      snapshotOf: () => valid(),
      runtime: { resolve, cached: vi.fn(), invalidate: vi.fn() }
    })
    const pending = catalog.reconcile('gate', valid())

    const invalidated = catalog.invalidate()
    releaseFirst(config(['late-model']))
    await Promise.all([pending, invalidated])

    expect(resolve).toHaveBeenCalledTimes(2)
    expect(catalog.list()[0]?.models[0]).toMatchObject({ model: 'latest-model' })
  })

  it('keeps invalidated entries absent when the current snapshot is unusable', async () => {
    const resolve = vi.fn(async () => config(['corp-model']))
    const catalog = createRuntimeModelCatalog({
      contributions: [contribution],
      snapshotOf: () => ({ ...valid(), status: 'expired' }),
      runtime: { resolve, cached: vi.fn(), invalidate: vi.fn() }
    })
    await catalog.reconcile('gate', valid())

    await catalog.invalidate()

    expect(resolve).toHaveBeenCalledTimes(1)
    expect(catalog.list()).toEqual([])
  })

  it('contains replay fetch failures and leaves the invalidated entry absent', async () => {
    const resolve = vi
      .fn()
      .mockResolvedValueOnce(config(['corp-model']))
      .mockRejectedValueOnce(new Error('offline'))
    const catalog = createRuntimeModelCatalog({
      contributions: [contribution],
      snapshotOf: () => valid(),
      runtime: { resolve, cached: vi.fn(), invalidate: vi.fn() }
    })
    await catalog.reconcile('gate', valid())

    await expect(catalog.invalidate()).resolves.toBeUndefined()
    expect(catalog.list()).toEqual([])
  })
})
