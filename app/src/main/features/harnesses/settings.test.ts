import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mkdirSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { HarnessSettingsService } from './settings'
import { expandEnvRecord, mergeEnvLayers } from './env'
import {
  defaultModelFamily,
  modelNameForFamily,
  resolveTitleModel,
  toAgentEnvironments,
  type ParsedModel
} from './models'
import {
  defaultProvider,
  listAdapters,
  listProviders,
  type HarnessModelProviderEntry
} from './settings-entries'

let root: string
const settingsDir = (): string => join(root, 'sources', 'settings', 'claude')

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

    const entries = listProviders('claude', root)
    expect(entries.map((e) => e.key)).toEqual(['claude-anthropic', 'claude-bedrock'])
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
    expect(listAdapters(root)).toEqual(['claude'])
  })

  it('settings.json 부재/손상은 기본 모델(3 alias)로 열거 — 디렉토리=열거 SSOT', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    mkdirSync(join(settingsDir(), 'anthropic'), { recursive: true })
    expect(listProviders('claude', root)[0].models.map((m) => m.alias)).toEqual([
      'sonnet',
      'opus',
      'haiku'
    ])

    writeFile(join(settingsDir(), 'anthropic', 'settings.json'), '{broken')
    expect(listProviders('claude', root)[0].models.map((m) => m.alias)).toEqual([
      'sonnet',
      'opus',
      'haiku'
    ])
  })

  it('settings 트리 부재 시 빈 배열 (스캐폴드 전 안전)', () => {
    expect(listProviders('claude', root)).toEqual([])
    expect(listAdapters(root)).toEqual([])
  })

  it('defaultProvider 는 anthropic 우선, 없으면 이름순 첫 항목', () => {
    mkdirSync(join(settingsDir(), 'vertex'), { recursive: true })
    mkdirSync(join(settingsDir(), 'bedrock'), { recursive: true })
    expect(defaultProvider(listProviders('claude', root))?.modelProviderId).toBe('bedrock')
    mkdirSync(join(settingsDir(), 'anthropic'), { recursive: true })
    expect(defaultProvider(listProviders('claude', root))?.modelProviderId).toBe('anthropic')
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

  it('modelNameForFamily 는 oneMillionContext 면 [1m] 접미사를 재부착한다 (0142)', () => {
    const oneM: ParsedModel[] = [
      {
        alias: 'opus',
        model: 'global.anthropic.claude-opus-4-8',
        isCustom: true,
        oneMillionContext: true,
        isDefault: true
      }
    ]
    // 설정의 `[1m]` 이 SDK query 의 options.model 로 되살아나야 1M 베타가 켜진다.
    expect(modelNameForFamily(oneM, 'opus')).toBe('global.anthropic.claude-opus-4-8[1m]')
    // oneMillionContext=false 면 접미사 없음(무회귀).
    expect(modelNameForFamily(models, 'sonnet')).toBe('claude-sonnet-4-6')
  })

  it('defaultModelFamily 는 default 항목의 alias, 빈 배열이면 null', () => {
    expect(defaultModelFamily(models)).toBe('sonnet')
    expect(defaultModelFamily([])).toBeNull()
  })

  it('resolveTitleModel 은 haiku 보유 시 haiku, 없으면 default, 빈 배열이면 undefined', () => {
    // haiku 보유 → bare alias(haiku, null 모델).
    expect(resolveTitleModel(models)).toBe('haiku')
    // haiku 없음 → default 모델로 폴백.
    expect(resolveTitleModel([models[0]])).toBe('claude-sonnet-4-6')
    expect(resolveTitleModel([])).toBeUndefined()
  })
})

describe('toAgentEnvironments', () => {
  it('ParsedModel 을 그대로 통과시키고 비밀 계열 필드를 노출하지 않는다', () => {
    const entries: HarnessModelProviderEntry[] = [
      {
        key: 'claude-bedrock',
        harnessId: 'claude',
        modelProviderId: 'bedrock',
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
      { key: 'opencode-local', harnessId: 'opencode', modelProviderId: 'local', models: [] }
    ]
    const envs = toAgentEnvironments(entries, ['claude'])
    // wire DTO 는 **compat 필드명을 유지한다** (0188 D-030) — 도메인 어휘는 이 경계에서 변환된다.
    expect(envs[0]).toEqual({
      key: 'claude-bedrock',
      adapter: 'claude',
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

describe('HarnessSettingsService', () => {
  function seedSource(modelProviderId: string, settings: string): string {
    const file = join(root, 'sources', 'settings', 'claude', modelProviderId, 'settings.json')
    writeFile(file, settings)
    return file
  }

  function entryOf(modelProviderId: string): HarnessModelProviderEntry {
    return {
      key: `claude-${modelProviderId}`,
      harnessId: 'claude',
      modelProviderId,
      models: []
    }
  }

  it('로더에 sources 경로를 위임하고 결과를 blob({settings})으로 돌려준다', async () => {
    seedSource('anthropic', '{"env":{"A":"1"}}')
    let seenFile = ''
    const loader = vi.fn(async (a: { sourcesSettingsFile: string }) => {
      seenFile = a.sourcesSettingsFile
      return { settings: { env: { A: '1' }, model: 'm' } }
    })
    const svc = new HarnessSettingsService({ claude: loader }, root)
    const blob = await svc.resolve(entryOf('anthropic'))
    expect(blob).toMatchObject({
      providerKey: 'claude-anthropic',
      // wire 필드명은 유지된다 — `ResolvedHarnessSettings.provider` 는 adapter 가 읽는다.
      provider: 'anthropic',
      settings: { env: { A: '1' }, model: 'm' }
    })
    expect(seenFile).toBe(join(root, 'sources', 'settings', 'claude', 'anthropic', 'settings.json'))
  })

  it('mtime 캐시 — 동일 mtime 재호출은 로더를 다시 부르지 않고 invalidateAll 후 재해석한다', async () => {
    const file = seedSource('anthropic', '{}')
    utimesSync(file, new Date(1000), new Date(1000))
    const loader = vi.fn(async () => ({ settings: {} }))
    const svc = new HarnessSettingsService({ claude: loader }, root)
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
    const svc = new HarnessSettingsService({ claude: failing }, root)
    expect(
      await svc.resolve({
        key: 'opencode-local',
        harnessId: 'opencode',
        modelProviderId: 'local',
        models: []
      })
    ).toBeUndefined()
    expect(await svc.resolve(entryOf('anthropic'))).toBeUndefined()
  })

  it('list 캐시 — 동일 어댑터 재호출은 디스크를 다시 읽지 않고 invalidateAll 후 재열거한다', () => {
    seedSource('anthropic', '{}')
    const svc = new HarnessSettingsService({}, root)
    expect(svc.list('claude').map((e) => e.modelProviderId)).toEqual(['anthropic'])

    // 디스크에 provider 추가 — 캐시 히트라 list 결과는 그대로.
    seedSource('bedrock', '{}')
    expect(svc.list('claude').map((e) => e.modelProviderId)).toEqual(['anthropic'])

    // 무효화 후 재열거.
    svc.invalidateAll()
    expect(svc.list('claude').map((e) => e.modelProviderId)).toEqual(['anthropic', 'bedrock'])
  })
})
