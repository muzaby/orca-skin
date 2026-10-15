import { afterEach, describe, expect, it, vi } from 'vitest'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  createAdapterRegistry,
  createHarnessSettingsService,
  mainHarnessModules,
  parseHarnessRuntimeModels,
  legacySettingsEnvHoist
} from './registry'
import { createRuntimeModelCatalog } from '../../features/harnesses/common/runtime-catalog'
import { prepareHarnessConfig } from '../../adapters/common/harness-config'

const roots: string[] = []
afterEach(() => {
  vi.restoreAllMocks()
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
})

describe('main harness composition', () => {
  it('creates exactly the registered adapters, keeps Claude active, and closes each owner', () => {
    const claude = vi.spyOn(mainHarnessModules.claude, 'createAdapter')
    const opencode = vi.spyOn(mainHarnessModules.opencode, 'createAdapter')
    const options = {
      dataDirectory: 'unused',
      preferences: () => undefined,
      fetchImpl: vi.fn<typeof fetch>()
    }
    const registry = createAdapterRegistry(options)
    expect(claude).toHaveBeenCalledExactlyOnceWith(options)
    expect(opencode).toHaveBeenCalledExactlyOnceWith(options)
    expect(registry.list().map((entry) => entry.id)).toEqual(['claude', 'opencode'])
    expect(registry.getActiveId()).toBe('claude')
    expect(registry.get('opencode')?.describe().provider).toBe('opencode')
    const close = vi.spyOn(registry.get('opencode')!, 'close')
    registry.select('opencode')
    expect(registry.getActive()).toBe(registry.get('opencode'))
    registry.close()
    expect(close).toHaveBeenCalledOnce()
  })

  it('runs registered parsers through the real settings service and preserves unsupported-directory fallback', () => {
    const root = mkdtempSync(join(tmpdir(), 'orca-harness-registry-'))
    roots.push(root)
    const write = (harness: string, settings: unknown): void => {
      const dir = join(root, 'sources', 'settings', harness, 'fixture')
      mkdirSync(dir, { recursive: true })
      writeFileSync(join(dir, 'settings.json'), JSON.stringify(settings))
    }
    write('claude', { env: { ANTHROPIC_DEFAULT_SONNET_MODEL: 'claude-native' } })
    write('opencode', {
      provider: { custom: { models: { native: { name: 'OpenCode native' } } } },
      model: 'custom/native'
    })
    write('legacy', { env: { ANTHROPIC_DEFAULT_SONNET_MODEL: 'legacy-native' } })
    const claude = vi.spyOn(mainHarnessModules.claude, 'parseSettingsModels')
    const opencode = vi.spyOn(mainHarnessModules.opencode, 'parseSettingsModels')
    const service = createHarnessSettingsService(root)
    expect(service.list('claude')[0].models[0].model).toBe('claude-native')
    expect(service.list('opencode')[0].models[0]).toMatchObject({
      alias: 'OpenCode native',
      model: 'custom/native',
      isDefault: true
    })
    expect(service.list('legacy')[0].models[0].model).toBe('legacy-native')
    expect(claude).toHaveBeenCalledTimes(2)
    expect(opencode).toHaveBeenCalledOnce()
    service.list('opencode')
    expect(opencode).toHaveBeenCalledOnce()
    service.invalidateAll()
    service.list('opencode')
    expect(opencode).toHaveBeenCalledTimes(2)
  })

  it('runs the composed runtime parser after resolve and preserves explicit legacy contributions', async () => {
    const parse = vi.spyOn(mainHarnessModules.claude, 'parseRuntimeModels')
    const config = {
      key: 'legacy-corp',
      harnessId: 'legacy',
      modelProviderId: 'corp',
      runtimeEnv: { ANTHROPIC_MODEL: 'explicit-model' },
      availableModels: ['listed-model']
    }
    const catalog = createRuntimeModelCatalog({
      contributions: [{ ...config, authId: 'fixture' }],
      runtime: { resolve: vi.fn(async () => config), cached: vi.fn(), invalidate: vi.fn() },
      snapshotOf: () => ({
        authId: 'fixture',
        status: 'valid',
        verified: true,
        credentialRevision: 1
      }),
      parseModels: parseHarnessRuntimeModels
    })
    await catalog.reconcile('fixture', {
      authId: 'fixture',
      status: 'valid',
      verified: true,
      credentialRevision: 1
    })
    expect(parse).toHaveBeenCalledExactlyOnceWith(config)
    expect(catalog.list()[0].models.map((model) => model.model)).toEqual([
      'listed-model',
      'explicit-model'
    ])
    expect(catalog.list()[0].models.find((model) => model.isDefault)?.model).toBe('explicit-model')
  })

  it.each(['claude', 'opencode', 'legacy'])(
    'keeps inherited host-managed preparation for %s',
    (harnessId) => {
      const baseEnv = vi.fn(() => ({ CLAUDE_CODE_PROVIDER_MANAGED_BY_HOST: '1' }))
      const prepared = prepareHarnessConfig({
        config: {
          key: `${harnessId}-custom`,
          harnessId,
          modelProviderId: 'custom',
          runtimeEnv: {},
          settings: {
            providerKey: `${harnessId}-custom`,
            provider: 'custom',
            settings: { env: { TOKEN: 'fixture' }, model: 'native' },
            sourceRevision: '1'
          }
        },
        baseEnv,
        settingsEnvHoist: legacySettingsEnvHoist
      })
      expect(baseEnv).toHaveBeenCalledOnce()
      expect(prepared.env).toEqual({ CLAUDE_CODE_PROVIDER_MANAGED_BY_HOST: '1', TOKEN: 'fixture' })
      expect(prepared.providerSettings?.settings).toEqual({ model: 'native' })
    }
  )
})
