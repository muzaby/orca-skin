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
  toAgentEnvironments,
  type OrcaModelConfig,
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
  it('디렉토리가 열거 SSOT — meta.json 은 라벨/모델만 공급한다', () => {
    writeFile(join(settingsDir(), 'anthropic', 'settings.json'), '{}')
    mkdirSync(join(settingsDir(), 'bedrock'), { recursive: true })
    writeFile(
      join(settingsDir(), 'meta.json'),
      JSON.stringify({
        anthropic: { label: 'Anthropic', models: [{ name: 'claude-sonnet-4-6', default: true }] }
      })
    )

    const entries = listProviders('claude-code', root)
    expect(entries.map((e) => e.key)).toEqual(['claude-code-anthropic', 'claude-code-bedrock'])
    expect(entries[0].label).toBe('Anthropic')
    expect(entries[0].models).toEqual([{ name: 'claude-sonnet-4-6', default: true }])
    expect(entries[1].models).toEqual([])
    expect(listAdapters(root)).toEqual(['claude-code'])
  })

  it('디렉토리 없는 meta 키는 경고 후 무시하고, 손상 meta 는 열거에 영향이 없다', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    mkdirSync(join(settingsDir(), 'anthropic'), { recursive: true })
    writeFile(join(settingsDir(), 'meta.json'), JSON.stringify({ ghost: { label: 'X' } }))
    expect(listProviders('claude-code', root)).toHaveLength(1)
    expect(warn.mock.calls.join(' ')).toContain('ghost')

    writeFile(join(settingsDir(), 'meta.json'), '{broken')
    expect(listProviders('claude-code', root)).toHaveLength(1)
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

describe('model helpers (meta.json models 기준 — 구 0010 의미 보존)', () => {
  const models: OrcaModelConfig[] = [
    { name: 'claude-sonnet-4-5', family: 'sonnet', default: true },
    { name: 'claude-haiku-4-5' }
  ]

  it('modelNameForFamily 는 family/name 매칭 후 default, 빈 배열이면 undefined', () => {
    expect(modelNameForFamily(models, 'sonnet')).toBe('claude-sonnet-4-5')
    expect(modelNameForFamily(models, 'claude-haiku-4-5')).toBe('claude-haiku-4-5')
    expect(modelNameForFamily(models, 'missing')).toBe('claude-sonnet-4-5')
    expect(modelNameForFamily([], 'sonnet')).toBeUndefined()
  })

  it('defaultModelFamily 는 default 모델의 family/name, 빈 배열이면 null', () => {
    expect(defaultModelFamily(models)).toBe('sonnet')
    expect(defaultModelFamily([])).toBeNull()
  })
})

describe('toAgentEnvironments', () => {
  it('0010 페이로드 shape 를 유지하고 비밀 계열 필드를 노출하지 않는다', () => {
    const entries: ProviderEntry[] = [
      {
        key: 'claude-code-bedrock',
        adapter: 'claude-code',
        provider: 'bedrock',
        models: [{ name: 'claude-sonnet-4-5', family: 'sonnet', default: true }]
      },
      { key: 'opencode-local', adapter: 'opencode', provider: 'local', models: [] }
    ]
    const envs = toAgentEnvironments(entries, ['claude-code'])
    expect(envs[0]).toEqual({
      key: 'claude-code-bedrock',
      adapter: 'claude-code',
      provider: 'bedrock',
      supported: true,
      models: [{ name: 'claude-sonnet-4-5', family: 'sonnet', default: true }]
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
  function seedDist(provider: string, settings: string): string {
    const file = join(root, 'dist', 'claude-code', provider, '.claude', 'settings.json')
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

  it('로더에 dist/sources 경로와 resolver 를 위임하고 결과를 blob 으로 돌려준다', async () => {
    seedDist('anthropic', '{"env":{"A":"1"}}')
    const loader = vi.fn(async (args) => ({ marker: args.providerKey }))
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
      settings: { marker: 'claude-code-anthropic' }
    })
    expect(loader.mock.calls[0][0].distProviderDir).toBe(
      join(root, 'dist', 'claude-code', 'anthropic')
    )
    expect(loader.mock.calls[0][0].sourcesSettingsFile).toBe(
      join(root, 'sources', 'settings', 'claude-code', 'anthropic', 'settings.json')
    )
  })

  it('mtime 캐시 — 동일 mtime 재호출은 로더를 다시 부르지 않고 invalidateAll 후 재해석한다', async () => {
    const file = seedDist('anthropic', '{}')
    utimesSync(file, new Date(1000), new Date(1000))
    const loader = vi.fn(async () => ({}))
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
