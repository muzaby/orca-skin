import { describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  affectedRuntimeModelAuthIds,
  startRuntimeModelCatalogAfterDeploy
} from './runtime-model-startup'

describe('runtime model startup', () => {
  it('keeps the tested startup and cross-Auth ownership seams wired into Bootstrap', () => {
    const bootstrap = readFileSync(new URL('./bootstrap.ts', import.meta.url), 'utf8')

    expect(bootstrap).toContain('await startRuntimeModelCatalogAfterDeploy({')
    expect(bootstrap).toContain('affectedRuntimeModelAuthIds(')
  })

  it('finishes every deploy invalidation before catalog attach and Auth resume', async () => {
    const order: string[] = []
    const catalog = {
      list: () => [],
      isReadOnly: () => true,
      invalidate: vi.fn(() => order.push('catalog-invalidate')),
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
})
