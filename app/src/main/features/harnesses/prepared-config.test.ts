// spawn 입력 조립 — env 우선순위·secret 격리·fingerprint (0188 AC15·AC16·AC19).
//
// 0181 의 `buildTurnEnv` 는 `orca.json env + materialize().env` 두 층만 병합했다. 여기서는
// **네 층**(process → app → settings env → runtimeEnv)의 최종 값과, 그 값이 respawn 판정에
// 쓰이는 fingerprint 로 접히는지를 본다.

import { describe, expect, it } from 'vitest'
import type { ResolvedHarnessSettings } from '../../adapters/harness-config'
import { prepareHarnessConfig, harnessEnvFingerprint } from './prepared-config'
import type { HarnessRuntimeConfig } from './runtime-config'

function settings(
  env?: Record<string, unknown>,
  extra?: Record<string, unknown>
): ResolvedHarnessSettings {
  return {
    providerKey: 'claude-corp',
    provider: 'corp',
    settings: { ...(env ? { env } : {}), ...extra },
    sourceRevision: 'rev-1'
  }
}

function config(overrides: Partial<HarnessRuntimeConfig> = {}): HarnessRuntimeConfig {
  return {
    key: 'claude-corp',
    harnessId: 'claude',
    modelProviderId: 'corp',
    runtimeEnv: {},
    ...overrides
  }
}

const BASE = (): Record<string, string> => ({ PATH: '/usr/bin', INHERITED: 'from-process' })

describe('env 우선순위 (AC15)', () => {
  it('runtimeEnv > settings env > app env > process env', () => {
    const prepared = prepareHarnessConfig({
      config: config({
        settings: settings({ LAYER: 'settings', ONLY_SETTINGS: 's' }),
        runtimeEnv: { LAYER: 'runtime' }
      }),
      appEnv: { LAYER: 'app', ONLY_APP: 'a' },
      baseEnv: BASE
    })

    expect(prepared.env?.LAYER).toBe('runtime')
    expect(prepared.env?.ONLY_SETTINGS).toBe('s')
    expect(prepared.env?.ONLY_APP).toBe('a')
    // SDK `options.env` 는 subprocess env 를 **대체**하므로 상속을 잃으면 안 된다.
    expect(prepared.env?.INHERITED).toBe('from-process')
  })

  it('app env 는 settings env 를 덮는다', () => {
    const prepared = prepareHarnessConfig({
      config: config({ settings: settings({ SHARED: 'settings' }), runtimeEnv: { X: '1' } }),
      appEnv: { SHARED: 'app' },
      baseEnv: BASE
    })

    expect(prepared.env?.SHARED).toBe('app')
  })

  it('충돌하는 settings env 키는 in-memory copy 에서 제거된다 — SDK 우선순위와 무관하게 결과가 하나다', () => {
    const source = settings({ TOKEN: 'from-settings', KEEP: 'yes' }, { model: 'm' })
    const prepared = prepareHarnessConfig({
      config: config({ settings: source, runtimeEnv: { TOKEN: 'from-runtime' } }),
      baseEnv: BASE
    })

    const adjustedEnv = (prepared.providerSettings?.settings as { env: Record<string, string> }).env
    expect(adjustedEnv).toEqual({ KEEP: 'yes' })
    // 비-env 항목은 그대로 `options.settings` 채널로 간다.
    expect(prepared.providerSettings?.settings).toMatchObject({ model: 'm' })
    expect(prepared.env?.TOKEN).toBe('from-runtime')
  })

  it('디스크 원본을 수정하지 않는다 — 제거는 사본에서만 일어난다', () => {
    const source = settings({ TOKEN: 'from-settings' })
    prepareHarnessConfig({
      config: config({ settings: source, runtimeEnv: { TOKEN: 'from-runtime' } }),
      baseEnv: BASE
    })

    expect(source.settings).toEqual({ env: { TOKEN: 'from-settings' } })
  })

  it('충돌이 없으면 같은 settings 참조를 유지한다 — 참조 비교 빠른 경로가 계속 성립한다', () => {
    const source = settings({ KEEP: 'yes' })
    const prepared = prepareHarnessConfig({
      config: config({ settings: source, runtimeEnv: { OTHER: '1' } }),
      baseEnv: BASE
    })

    expect(prepared.providerSettings?.settings).toBe(source.settings)
  })

  it('동적 값도 app env 도 없으면 env 옵션을 생략한다 — SDK 기본 상속을 유지한다', () => {
    const prepared = prepareHarnessConfig({
      config: config({ settings: settings({ A: '1' }) }),
      baseEnv: BASE
    })

    expect(prepared.env).toBeUndefined()
  })

  it('settings env 의 비-문자열 값은 subprocess env 로 흘리지 않는다', () => {
    const prepared = prepareHarnessConfig({
      config: config({
        settings: settings({ NUM: 1, OBJ: { a: 1 }, OK: 'yes' }),
        runtimeEnv: { X: '1' }
      }),
      baseEnv: BASE
    })

    expect(prepared.env?.OK).toBe('yes')
    expect(prepared.env?.NUM).toBeUndefined()
    expect(prepared.env?.OBJ).toBeUndefined()
  })
})

describe('secret 격리 (AC16)', () => {
  it('동적 token 은 options.env 에만 있고 options.settings 에는 복제되지 않는다', () => {
    const prepared = prepareHarnessConfig({
      config: config({
        settings: settings({ ANTHROPIC_AUTH_TOKEN: 'old-token' }),
        runtimeEnv: { ANTHROPIC_AUTH_TOKEN: 'live-token' }
      }),
      baseEnv: BASE
    })

    expect(prepared.env?.ANTHROPIC_AUTH_TOKEN).toBe('live-token')
    expect(JSON.stringify(prepared.providerSettings?.settings)).not.toContain('live-token')
  })

  it('sourceRevision 은 adapter 에 넘기는 settings blob 에 섞이지 않는다', () => {
    const prepared = prepareHarnessConfig({
      config: config({ settings: settings({ A: '1' }), runtimeEnv: { B: '2' } }),
      baseEnv: BASE
    })

    expect(prepared.providerSettings?.settings).not.toHaveProperty('sourceRevision')
    // 메타는 wrapper 에 남는다 — cache 정합성에 쓰인다.
    expect(prepared.providerSettings?.sourceRevision).toBe('rev-1')
  })
})

describe('env fingerprint (AC19)', () => {
  it('같은 입력은 같은 값 — 키 순서가 달라도 같다', () => {
    expect(harnessEnvFingerprint({ Y: '1', X: '2' })).toBe(
      harnessEnvFingerprint({ X: '2', Y: '1' })
    )
  })

  it('env 의 token 이 바뀌면 값이 달라진다', () => {
    // 이것이 `providerSettingsChangedSinceSpawn` 만으로는 잡히지 않던 자리다.
    expect(harnessEnvFingerprint({ TOKEN: 'a' })).not.toBe(harnessEnvFingerprint({ TOKEN: 'b' }))
  })

  // r2 — settings 축은 이 값이 보지 않는다. 두 판정이 겹치면 나중에 한쪽만 고쳐지고,
  // 무엇보다 0125 의 "해석 실패는 경계가 아니다" 가 조용히 뒤집힌다.
  it('settings 가 달라도 env 가 같으면 같은 값이다 — settings 축은 별도 판정이 소유한다', () => {
    const withSettings = prepareHarnessConfig({
      config: config({ settings: settings(undefined, { model: 'a' }), runtimeEnv: { T: '1' } }),
      baseEnv: BASE
    })
    const otherSettings = prepareHarnessConfig({
      config: config({ settings: settings(undefined, { model: 'b' }), runtimeEnv: { T: '1' } }),
      baseEnv: BASE
    })

    expect(withSettings.runtimeEnvFingerprint).toBe(otherSettings.runtimeEnvFingerprint)
  })

  // r1 은 `{settings, env}` 를 함께 접어 **loader 가 일시 실패한 턴마다** 채널을 내리고
  // settings 없이 respawn 했다. 0125 는 그 경우를 보수적 no-op 으로 못 박았다.
  //
  // env-only 로 좁히면 두 경우가 옳게 갈린다:
  it('settings 해석 실패 — 비-env 항목만 있던 경우는 env 가 그대로라 respawn 근거가 없다', () => {
    const resolved = prepareHarnessConfig({
      config: config({ settings: settings(undefined, { model: 'm' }), runtimeEnv: { T: '1' } }),
      baseEnv: BASE
    })
    const failed = prepareHarnessConfig({
      config: config({ runtimeEnv: { T: '1' } }),
      baseEnv: BASE
    })

    // 여기서 `providerSettingsChangedSinceSpawn` 도 한쪽이 undefined 라 false 다 →
    // 두 입력 모두 false → 채널 유지. r1 은 이 턴에 respawn 했다.
    expect(failed.runtimeEnvFingerprint).toBe(resolved.runtimeEnvFingerprint)
  })

  it('settings 해석 실패 — env 항목이 있었다면 최종 env 가 실제로 달라지므로 값도 달라진다', () => {
    const resolved = prepareHarnessConfig({
      config: config({ settings: settings({ A: '1' }), runtimeEnv: { T: '1' } }),
      baseEnv: BASE
    })
    const failed = prepareHarnessConfig({
      config: config({ runtimeEnv: { T: '1' } }),
      baseEnv: BASE
    })

    // subprocess 가 정말로 `A` 없이 돈다 — 이때의 respawn 은 과잉이 아니라 정확하다.
    expect(failed.runtimeEnvFingerprint).not.toBe(resolved.runtimeEnvFingerprint)
    expect(failed.env?.A).toBeUndefined()
  })

  it('정상 steady state 는 같은 값을 낸다 — 상시 respawn 을 만들지 않는다', () => {
    const build = (): ReturnType<typeof prepareHarnessConfig> =>
      prepareHarnessConfig({
        config: config({ settings: settings({ A: '1' }), runtimeEnv: { TOKEN: 't' } }),
        appEnv: { APP: '1' },
        baseEnv: BASE
      })

    expect(build().runtimeEnvFingerprint).toBe(build().runtimeEnvFingerprint)
  })
})
