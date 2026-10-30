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
  it('uses each harness context policy through the registered module', () => {
    const config = { provider: { custom: { models: { small: { limit: { context: 4096 } } } } } }
    expect(mainHarnessModules.opencode.recoveryContextWindow(config, 'custom/small')).toBe(4096)
    expect(mainHarnessModules.opencode.recoveryContextWindow(config, 'custom/unknown')).toBe(200000)
    expect(mainHarnessModules.claude.recoveryContextWindow(config, 'claude-sonnet-4-5')).toBe(
      200000
    )
    expect(mainHarnessModules.claude.recoveryContextWindow(config, 'claude-sonnet-4-5-1m')).toBe(
      1000000
    )
  })
  it('resolves each registered native loader without mixing harness policies', async () => {
    const root = mkdtempSync(join(tmpdir(), 'orca-harness-loaders-'))
    roots.push(root)
    const source = {
      permissions: { defaultMode: 'bypassPermissions', allow: ['Read'] },
      provider: { custom: { models: { native: { name: 'Native model' } } } }
    }
    for (const harness of ['claude', 'opencode']) {
      const dir = join(root, 'sources', 'settings', harness, 'fixture')
      mkdirSync(dir, { recursive: true })
      writeFileSync(join(dir, 'settings.json'), JSON.stringify(source))
    }
    const service = createHarnessSettingsService(root)
    const resolve = (harnessId: string): ReturnType<typeof service.resolve> =>
      service.resolve({ harnessId, modelProviderId: 'fixture', key: `${harnessId}-fixture` })
    const claude = await resolve('claude')
    const opencode = await resolve('opencode')
    expect(claude).toMatchObject({
      providerKey: 'claude-fixture',
      provider: 'fixture',
      settings: { ...source, permissions: { allow: ['Read'] } }
    })
    expect(opencode).toMatchObject({
      providerKey: 'opencode-fixture',
      provider: 'fixture',
      settings: source
    })
    expect(claude?.settings.permissions).not.toHaveProperty('defaultMode')
    expect(opencode?.sourceRevision).toContain(join(root, 'sources', 'settings', 'opencode'))
    expect(await resolve('legacy')).toBeUndefined()
    expect(await resolve('opencode')).toEqual(opencode)
    service.invalidateAll()
    expect(await resolve('claude')).toEqual(claude)
    expect(await resolve('opencode')).toEqual(opencode)
  })

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

  it('parses opencode runtime configs with the OpenCode parser', async () => {
    const claude = vi.spyOn(mainHarnessModules.claude, 'parseRuntimeModels')
    const config = {
      key: 'opencode-corp',
      harnessId: 'opencode',
      modelProviderId: 'corp',
      runtimeEnv: {},
      availableModels: ['corp/b', 'not-qualified', 'corp/a'],
      modelDetails: { 'corp/b': { name: 'B 모델', variants: ['high'] } }
    }
    const catalog = createRuntimeModelCatalog({
      contributions: [{ ...config, authId: 'opencode-llm' }],
      runtime: { resolve: vi.fn(async () => config), cached: vi.fn(), invalidate: vi.fn() },
      snapshotOf: () => ({
        authId: 'opencode-llm',
        status: 'valid',
        verified: true,
        credentialRevision: 1
      }),
      parseModels: parseHarnessRuntimeModels
    })
    await catalog.reconcile('opencode-llm', {
      authId: 'opencode-llm',
      status: 'valid',
      verified: true,
      credentialRevision: 1
    })
    expect(claude).not.toHaveBeenCalled()
    expect(catalog.list()[0]).toMatchObject({ source: 'runtime', readOnly: true })
    expect(catalog.list()[0].models).toEqual([
      {
        alias: 'B 모델',
        model: 'corp/b',
        providerId: 'corp',
        isCustom: true,
        oneMillionContext: false,
        isDefault: true,
        variants: ['high']
      },
      {
        alias: 'a',
        model: 'corp/a',
        providerId: 'corp',
        isCustom: true,
        oneMillionContext: false,
        isDefault: false,
        variants: []
      }
    ])
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
