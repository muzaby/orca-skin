import { describe, expect, it, vi } from 'vitest'
import type { AgentEnvironment } from '../../shared/ipc'
import {
  affectedRuntimeModelAuthIds,
  createRuntimeModelAuthInvalidator,
  createRuntimeModelAuthResume,
  invalidateRuntimeModelsForAuth,
  startRuntimeModelCatalogAfterDeploy
} from './runtime-model-startup'

describe('runtime model startup', () => {
  it('finishes every deploy invalidation before catalog attach and Auth resume', async () => {
    const order: string[] = []
    const catalog = {
      list: () => [],
      isReadOnly: () => true,
      merge: (settings: AgentEnvironment[]) => settings,
      invalidate: vi.fn(async () => {
        order.push('catalog-invalidate')
      }),
      reconcile: vi.fn(async () => undefined)
    }
    await startRuntimeModelCatalogAfterDeploy({
      invalidateSettings: () => order.push('settings-invalidate'),
      invalidateRuntime: () => order.push('runtime-invalidate'),
      catalog,
      bridge: {
        onSnapshot: vi.fn(async () => undefined),
        attach: vi.fn(async () => {
          order.push('attach')
        })
      },
      resumeAuth: () => order.push('resume')
    })

    expect(order).toEqual([
      'settings-invalidate',
      'runtime-invalidate',
      'catalog-invalidate',
      'attach',
      'resume'
    ])
  })

  it('waits for catalog replay to settle before attaching the bridge', async () => {
    let release!: () => void
    const order: string[] = []
    const pending = startRuntimeModelCatalogAfterDeploy({
      invalidateSettings: vi.fn(),
      invalidateRuntime: vi.fn(),
      catalog: {
        list: () => [],
        isReadOnly: () => true,
        merge: (settings: AgentEnvironment[]) => settings,
        invalidate: () =>
          new Promise<void>((resolve) => {
            release = resolve
          }),
        reconcile: vi.fn(async () => undefined)
      },
      bridge: {
        onSnapshot: vi.fn(async () => undefined),
        attach: vi.fn(async () => {
          order.push('attach')
        })
      },
      resumeAuth: () => order.push('resume')
    })

    await Promise.resolve()
    expect(order).toEqual([])
    release()
    await pending
    expect(order).toEqual(['attach', 'resume'])
  })

  it('returns every Auth owner of invalidated canonical contribution keys', () => {
    expect(
      affectedRuntimeModelAuthIds(
        [' ORCA-SHARED '],
        [
          { authId: 'a', key: 'orca-shared', harnessId: 'orca', modelProviderId: 'a' },
          { authId: 'b', key: 'ORCA-SHARED', harnessId: 'orca', modelProviderId: 'b' },
          { authId: 'c', key: 'orca-other', harnessId: 'orca', modelProviderId: 'c' }
        ]
      )
    ).toEqual(['a', 'b'])
  })

  it('reconciles every Auth owner after invalidating shared contribution keys', () => {
    const invalidated: string[] = []
    const reconciled: string[] = []
    invalidateRuntimeModelsForAuth({
      keys: [' ORCA-SHARED '],
      contributions: [
        { authId: 'a', key: 'orca-shared', harnessId: 'orca', modelProviderId: 'a' },
        { authId: 'b', key: 'ORCA-SHARED', harnessId: 'orca', modelProviderId: 'b' }
      ],
      invalidate: (key) => invalidated.push(key),
      snapshotOf: (authId) => ({ authId }) as never,
      reconcile: (authId) => reconciled.push(authId)
    })

    expect(invalidated).toEqual([' ORCA-SHARED '])
    expect(reconciled).toEqual(['a', 'b'])
  })

  it('derives invalidated keys from the full deployment declarations', () => {
    const invalidated: string[] = []
    const reconciled: string[] = []
    const invalidateForAuth = createRuntimeModelAuthInvalidator({
      invalidatedKeys: { a: ['runtime-env'] },
      contributions: [
        { authId: 'a', key: 'shared', harnessId: 'orca', modelProviderId: 'a' },
        { authId: 'b', key: 'SHARED', harnessId: 'orca', modelProviderId: 'b' }
      ],
      invalidate: (key) => invalidated.push(key),
      snapshotOf: (authId) => ({ authId }) as never,
      reconcile: (authId) => reconciled.push(authId)
    })

    invalidateForAuth('a')

    expect(invalidated).toEqual(['runtime-env', 'shared'])
    expect(reconciled).toEqual(['a', 'b'])
  })

  it('installs both Auth listeners before running the real resume callback', () => {
    const order: string[] = []
    const listeners: Array<(change: never) => void> = []
    const resume = createRuntimeModelAuthResume({
      auth: {
        subscribe: (listener) => {
          order.push('subscribe')
          listeners.push(listener as never)
          return () => undefined
        }
      },
      onChange: () => order.push('change'),
      onGateChange: (authId) => order.push(`gate:${authId}`),
      run: () => order.push('run')
    })

    resume()
    listeners[0]?.({ kind: 'snapshot', authId: 'gate' } as never)
    listeners[1]?.({ kind: 'snapshot', authId: 'gate' } as never)

    expect(order).toEqual(['subscribe', 'subscribe', 'run', 'change', 'gate:gate'])
  })
})
