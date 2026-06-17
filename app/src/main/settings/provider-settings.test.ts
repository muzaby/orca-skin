import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mkdirSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  defaultModelFamily,
  defaultProvider,
  expandEnvRecord,
  listAdapters,
  listProviders,
  mergeEnvLayers,
  modelNameForFamily,
  ProviderSettingsService,
  splitProviderSettings,
  toAgentEnvironments,
  type ParsedModel,
  type ProviderEntry
} from './provider-settings'

let root: string
const settingsDir = (): string => join(root, 'sources', 'settings', 'claude-code')

function writeFile(p: string, content: string): void {
  mkdirSync(join(p, '..'), { recursive: true })
  writeFileSync(p, content, 'utf8')
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'orca-provider-settings-'))
})
afterEach(() => {
  rmSync(root, { recursive: true, force: true })
  vi.restoreAllMocks()
})

describe('listProviders / listAdapters', () => {
  it('디렉토리가 열거 SSOT — 각 provider 의 settings.json 을 파싱해 모델을 채운다', () => {
    writeFile(
      join(settingsDir(), 'anthropic', 'settings.json'),
      JSON.stringify({ env: { ANTHROPIC_DEFAULT_SONNET_MODEL: 'claude-sonnet-4-6' } })
    )
    writeFile(join(settingsDir(), 'bedrock', 'settings.json'), '{}')

    const entries = listProviders('claude-code', root)
    expect(entries.map((e) => e.key)).toEqual(['claude-code-anthropic', 'claude-code-bedrock'])
    // 커스텀(sonnet) 만 노출, default.
    expect(entries[0].models).toEqual([
      {
        alias: 'sonnet',
        model: 'claude-sonnet-4-6',
        isCustom: true,
        oneMillionContext: false,
        isDefault: true
      }
    ])
    // 빈 settings → 3개 alias, sonnet default.
    expect(entries[1].models.map((m) => m.alias)).toEqual(['sonnet', 'opus', 'haiku'])
    expect(entries[1].models.filter((m) => m.isDefault)).toHaveLength(1)
    expect(listAdapters(root)).toEqual(['claude-code'])
  })

  it('settings.json 부재/손상은 기본 모델(3 alias)로 열거 — 디렉토리=열거 SSOT', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    mkdirSync(join(settingsDir(), 'anthropic'), { recursive: true })
    expect(listProviders('claude-code', root)[0].models.map((m) => m.alias)).toEqual([
      'sonnet',
      'opus',
      'haiku'
    ])

    writeFile(join(settingsDir(), 'anthropic', 'settings.json'), '{broken')
    expect(listProviders('claude-code', root)[0].models.map((m) => m.alias)).toEqual([
      'sonnet',
      'opus',
      'haiku'
    ])
  })

  it('settings 트리 부재 시 빈 배열 (스캐폴드 전 안전)', () => {
    expect(listProviders('claude-code', root)).toEqual([])
    expect(listAdapters(root)).toEqual([])
  })

  it('defaultProvider 는 anthropic 우선, 없으면 이름순 첫 항목', () => {
    mkdirSync(join(settingsDir(), 'vertex'), { recursive: true })
    mkdirSync(join(settingsDir(), 'bedrock'), { recursive: true })
    expect(defaultProvider(listProviders('claude-code', root))?.provider).toBe('bedrock')
    mkdirSync(join(settingsDir(), 'anthropic'), { recursive: true })
    expect(defaultProvider(listProviders('claude-code', root))?.provider).toBe('anthropic')
  })
})

describe('model helpers (alias 기준)', () => {
  const models: ParsedModel[] = [
    {
      alias: 'sonnet',
      model: 'claude-sonnet-4-6',
      isCustom: true,
      oneMillionContext: false,
      isDefault: true
    },
    { alias: 'haiku', model: null, isCustom: false, oneMillionContext: false, isDefault: false }
  ]

  it('modelNameForFamily 는 alias/model 매칭 후 default, null 모델은 bare alias 반환', () => {
    expect(modelNameForFamily(models, 'sonnet')).toBe('claude-sonnet-4-6')
    expect(modelNameForFamily(models, 'claude-sonnet-4-6')).toBe('claude-sonnet-4-6')
    // null 모델 alias → SDK 가 해석하도록 bare alias 그대로.
    expect(modelNameForFamily(models, 'haiku')).toBe('haiku')
    // 미매칭 → default 의 model.
    expect(modelNameForFamily(models, 'missing')).toBe('claude-sonnet-4-6')
    expect(modelNameForFamily([], 'sonnet')).toBeUndefined()
  })

  it('defaultModelFamily 는 default 항목의 alias, 빈 배열이면 null', () => {
    expect(defaultModelFamily(models)).toBe('sonnet')
    expect(defaultModelFamily([])).toBeNull()
  })
})

describe('toAgentEnvironments', () => {
  it('ParsedModel 을 그대로 통과시키고 비밀 계열 필드를 노출하지 않는다', () => {
    const entries: ProviderEntry[] = [
      {
        key: 'claude-code-bedrock',
        adapter: 'claude-code',
        provider: 'bedrock',
        models: [
          {
            alias: 'sonnet',
            model: 'claude-sonnet-4-6',
            isCustom: true,
            oneMillionContext: false,
            isDefault: true
          }
        ]
      },
      { key: 'opencode-local', adapter: 'opencode', provider: 'local', models: [] }
    ]
    const envs = toAgentEnvironments(entries, ['claude-code'])
    expect(envs[0]).toEqual({
      key: 'claude-code-bedrock',
      adapter: 'claude-code',
      provider: 'bedrock',
      supported: true,
      models: [
        {
          alias: 'sonnet',
          model: 'claude-sonnet-4-6',
          isCustom: true,
          oneMillionContext: false,
          isDefault: true
        }
      ]
    })
    expect(envs[1].supported).toBe(false)
    expect('authToken' in envs[0]).toBe(false)
    expect('env' in envs[0]).toBe(false)
  })
})

describe('env 유틸', () => {
  it('expandEnvRecord 는 미해결 변수가 있는 키만 드롭한다', () => {
    const { env, missing } = expandEnvRecord({ A: '${OK}', B: '${MISSING}', C: 'plain' }, (name) =>
      name === 'OK' ? 'v' : undefined
    )
    expect(env).toEqual({ A: 'v', C: 'plain' })
    expect(missing).toEqual(['MISSING'])
  })

  it('mergeEnvLayers 는 overlay 가 비면 base 그대로, 있으면 완전한 베이스 위에 병합한다', () => {
    expect(mergeEnvLayers(undefined, {})).toBeUndefined()
    const base = { PATH: '/bin' }
    expect(mergeEnvLayers(base, {})).toBe(base)
    expect(mergeEnvLayers(base, { A: '1' })).toEqual({ PATH: '/bin', A: '1' })
    // base 부재 + overlay 존재 → process.env 스냅샷 위에 병합 (SDK env 전체 대체 의미론).
    const merged = mergeEnvLayers(undefined, { ORCA_TEST_KEY: 'x' })!
    expect(merged.ORCA_TEST_KEY).toBe('x')
    expect(Object.keys(merged).length).toBeGreaterThan(1)
  })
})

describe('ProviderSettingsService', () => {
  function seedSource(provider: string, settings: string): string {
    const file = join(root, 'sources', 'settings', 'claude-code', provider, 'settings.json')
    writeFile(file, settings)
    return file
  }

  function entryOf(provider: string): ProviderEntry {
    return {
      key: `claude-code-${provider}`,
      adapter: 'claude-code',
      provider,
      models: []
    }
  }

  it('로더에 sources 경로와 resolver 를 위임하고 결과를 blob({settings, env})으로 돌려준다', async () => {
    seedSource('anthropic', '{"env":{"A":"1"}}')
    const loader = vi.fn(async (args) =>
      splitProviderSettings({ marker: args.providerKey }, { A: 'expanded' })
    )
    const svc = new ProviderSettingsService(
      { 'claude-code': loader },
      () => () => undefined,
      undefined,
      root
    )
    const blob = await svc.resolve(entryOf('anthropic'))
    expect(blob).toEqual({
      providerKey: 'claude-code-anthropic',
      provider: 'anthropic',
      settings: { marker: 'claude-code-anthropic' },
      env: { A: 'expanded' }
    })
    expect(loader.mock.calls[0][0].sourcesSettingsFile).toBe(
      join(root, 'sources', 'settings', 'claude-code', 'anthropic', 'settings.json')
    )
  })

  it('mtime 캐시 — 동일 mtime 재호출은 로더를 다시 부르지 않고 invalidateAll 후 재해석한다', async () => {
    const file = seedSource('anthropic', '{}')
    utimesSync(file, new Date(1000), new Date(1000))
    const loader = vi.fn(async () => splitProviderSettings({}, {}))
    const svc = new ProviderSettingsService(
      { 'claude-code': loader },
      () => () => undefined,
      undefined,
      root
    )
    await svc.resolve(entryOf('anthropic'))
    await svc.resolve(entryOf('anthropic'))
    expect(loader).toHaveBeenCalledTimes(1)

    // 파일 변경(mtime) → 재해석.
    utimesSync(file, new Date(2000), new Date(2000))
    await svc.resolve(entryOf('anthropic'))
    expect(loader).toHaveBeenCalledTimes(2)

    svc.invalidateAll()
    await svc.resolve(entryOf('anthropic'))
    expect(loader).toHaveBeenCalledTimes(3)
  })

  it('로더 미등록 어댑터와 로더 실패는 undefined (settings 없이 진행)', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const failing = vi.fn(async () => {
      throw new Error('boom')
    })
    const svc = new ProviderSettingsService(
      { 'claude-code': failing },
      () => () => undefined,
      undefined,
      root
    )
    expect(
      await svc.resolve({
        key: 'opencode-local',
        adapter: 'opencode',
        provider: 'local',
        models: []
      })
    ).toBeUndefined()
    expect(await svc.resolve(entryOf('anthropic'))).toBeUndefined()
  })
})
