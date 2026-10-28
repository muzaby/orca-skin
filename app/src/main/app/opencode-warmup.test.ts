import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, it, vi } from 'vitest'
import { ComposerPreparationService } from './composer-preparation-service'
import { OpenCodeWarmup } from './opencode-warmup'
import type { ComposerCatalogData, ComposerCatalogScope } from '../../shared/composer-catalog'

it('skips unavailable CLI and leaves an explicit foreground retry available', async () => {
  const acquire = vi.fn()
  const service = new ComposerPreparationService(acquire)
  const installed = vi.fn(async () => ({ installed: false }))
  const warmup = new OpenCodeWarmup({
    service,
    allowed: () => true,
    settings: () => ({ lastBackend: 'opencode', lastCwd: null }),
    cwd: () => process.cwd(),
    installed
  })
  warmup.update()
  await vi.waitFor(() => expect(installed).toHaveBeenCalledOnce())
  warmup.update()
  expect(acquire).not.toHaveBeenCalled()
  expect(installed).toHaveBeenCalledOnce()
  warmup.close()
  service.close()
})

it('uses the foreground cwd fallback and releases failed warmup for an explicit retry', async () => {
  const cwd = await mkdtemp(join(tmpdir(), 'orca-warmup-fallback-'))
  const release = vi.fn(async () => {})
  let failed = true
  const read = vi.fn(
    async <K extends keyof ComposerCatalogData>(part: K): Promise<ComposerCatalogData[K]> => {
      if (failed && part === 'models') throw new Error('unavailable')
      return [] as ComposerCatalogData[K]
    }
  )
  const resolve = vi.fn(async (_scope: ComposerCatalogScope) => {
    void _scope
    return {
      key: 'fallback',
      acquire: async () => ({
        generation: 'warm',
        signal: new AbortController().signal,
        read: async <K extends keyof ComposerCatalogData>(
          part: K
        ): Promise<ComposerCatalogData[K]> => (await read(part)) as ComposerCatalogData[K],
        release
      })
    }
  })
  const service = new ComposerPreparationService(resolve)
  const warmup = new OpenCodeWarmup({
    service,
    allowed: () => true,
    settings: () => ({ lastBackend: 'opencode', lastCwd: join(cwd, 'missing') }),
    cwd: () => cwd,
    installed: async () => ({ installed: true })
  })
  try {
    warmup.update()
    await vi.waitFor(() => expect(release).toHaveBeenCalledOnce())
    const scope = {
      backend: 'opencode' as const,
      sessionId: null,
      cwd,
      projectId: null,
      providerKey: null,
      agentKind: 'code' as const
    }
    expect(resolve.mock.calls[0][0]).toEqual(scope)
    expect(read.mock.calls.map(([part]) => part).sort()).toEqual(['agents', 'mcp', 'models'])
    warmup.update()
    expect(resolve).toHaveBeenCalledOnce()
    failed = false
    expect(
      await service
        .owners('catalog')
        .read(1, { owner: 'foreground', scope, part: 'models' }, () => {})
    ).toEqual({ part: 'models', value: [], generation: 'warm' })
    await service.owners('catalog').release(1, 'foreground')
    expect(release).toHaveBeenCalledTimes(2)
  } finally {
    warmup.close()
    service.close()
    await rm(cwd, { recursive: true, force: true })
  }
})
