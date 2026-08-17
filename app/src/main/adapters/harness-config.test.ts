// spawn 입력 조립 — env 우선순위·secret 격리·fingerprint (0188 AC15·AC16·AC19).
//
// 0181 의 `buildTurnEnv` 는 `orca.json env + materialize().env` 두 층만 병합했다. 여기서는
// **네 층**(process → app → settings env → runtimeEnv)의 최종 값과, 그 값이 respawn 판정에
// 쓰이는 fingerprint 로 접히는지를 본다.

import { describe, expect, it } from 'vitest'
import {
  harnessEnvFingerprint,
  prepareHarnessConfig,
  prepareUnresolvedHarnessConfig,
  type HarnessRuntimeConfig,
  type ResolvedHarnessSettings
} from './harness-config'

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

  // r3 정정 — r2 는 이 단언이 반대로 고정돼 있어 결함을 회귀로 잡는 대신 승인하고 있었다.
  // `orca.json` app env 는 **전역 폴백**이고 settings 는 **그 ModelProvider 전용 설정**이다.
  // 폴백이 전용을 이기면 게이트웨이를 바꿔도 URL·모델 변수가 따라오지 않는다.
  it('settings env 가 app env 를 덮는다 — 전용 설정이 전역 폴백을 이긴다', () => {
    const prepared = prepareHarnessConfig({
      config: config({ settings: settings({ SHARED: 'settings' }), runtimeEnv: { X: '1' } }),
      appEnv: { SHARED: 'app' },
      baseEnv: BASE
    })

    expect(prepared.env?.SHARED).toBe('settings')
  })

  it('네 층의 상대 순서가 계약과 같다 — runtime > settings > app > process', () => {
    const prepared = prepareHarnessConfig({
      config: config({
        settings: settings({ A: 'settings', B: 'settings', C: 'settings' }),
        runtimeEnv: { A: 'runtime' }
      }),
      appEnv: { A: 'app', B: 'app', D: 'app' },
      baseEnv: () => ({ A: 'process', B: 'process', C: 'process', D: 'process', E: 'process' })
    })

    expect(prepared.env).toMatchObject({
      A: 'runtime', // 4층 전부 충돌 → runtime
      B: 'settings', // settings·app·process → settings
      C: 'settings', // settings·process → settings
      D: 'app', // app·process → app
      E: 'process' // process 만 → 상속 유지
    })
  })

  // r3 정정 — r2 는 `runtimeEnv` 와 충돌하는 키만 지웠다. 그러면 settings·app 양쪽에 있는 키가
  // **두 채널에 동시에** 남아 최종 값이 SDK 내부 우선순위에 달린다.
  it('options.env 를 만드는 턴에는 settings 의 env 블록을 통째로 비운다', () => {
    const source = settings({ TOKEN: 'from-settings', KEEP: 'yes' }, { model: 'm' })
    const prepared = prepareHarnessConfig({
      config: config({ settings: source, runtimeEnv: { TOKEN: 'from-runtime' } }),
      baseEnv: BASE
    })

    // 두 채널에 같은 키가 동시에 남지 않는다 → SDK 우선순위와 무관하게 결과가 하나다.
    expect(prepared.providerSettings?.settings).not.toHaveProperty('env')
    // 비-env 항목은 그대로 `options.settings` 채널로 간다.
    expect(prepared.providerSettings?.settings).toMatchObject({ model: 'm' })
    // 비운 값은 사라지지 않고 우선순위대로 options.env 로 hoist 된다.
    expect(prepared.env?.TOKEN).toBe('from-runtime')
    expect(prepared.env?.KEEP).toBe('yes')
  })

  it('options.env 를 만들지 않는 턴에는 settings 채널을 건드리지 않는다 — 정적 배포 무회귀', () => {
    const source = settings({ A: '1' })
    const prepared = prepareHarnessConfig({
      config: config({ settings: source }),
      baseEnv: BASE
    })

    expect(prepared.env).toBeUndefined()
    expect(prepared.providerSettings?.settings).toBe(source.settings)
  })

  it('디스크 원본을 수정하지 않는다 — 제거는 사본에서만 일어난다', () => {
    const source = settings({ TOKEN: 'from-settings' })
    prepareHarnessConfig({
      config: config({ settings: source, runtimeEnv: { TOKEN: 'from-runtime' } }),
      baseEnv: BASE
    })

    expect(source.settings).toEqual({ env: { TOKEN: 'from-settings' } })
  })

  it('env 블록이 없으면 같은 settings 참조를 유지한다 — 참조 비교 빠른 경로가 계속 성립한다', () => {
    const source = settings(undefined, { model: 'm' })
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
    // 비-문자열이라 hoist 되지 못한 값이 settings 채널에 남아 이중 적용되지도 않는다.
    expect(prepared.providerSettings?.settings).not.toHaveProperty('env')
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
  // r3 — 값이 secret 원문을 담고 있으면 `SessionRuntime` 이 채널 수명 내내 그 사본을 들고 있게
  // 된다. 로그·DB 에 안 남겨도 표면은 표면이다.
  it('원문이 아니라 비가역 digest 다 — 토큰이 값 안에 남지 않는다', () => {
    const fingerprint = harnessEnvFingerprint({
      ANTHROPIC_AUTH_TOKEN: 'sk-super-secret-value',
      ANTHROPIC_BASE_URL: 'https://llm.example.corp'
    })

    expect(fingerprint).not.toContain('sk-super-secret-value')
    expect(fingerprint).not.toContain('llm.example.corp')
    expect(fingerprint).not.toContain('ANTHROPIC_AUTH_TOKEN')
  })

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

// ── r10: 해석 실패 턴은 "비었다" 가 아니라 "모른다" ────────────────────────────
//
// entry 를 못 고른 턴(`sources` 트리가 없는 어댑터 · 디렉터리 일시 부재)에서 r9 는 ① app env 를
// 통째로 떨어뜨리고 ② `harnessEnvFingerprint(undefined)` 라는 **정의된 값**을 냈다.
// `SessionRuntime` 은 spawn 마다 fingerprint 를 기록하므로 그 값이 곧 "env 가 바뀌었다" 로 읽혀
// 살아 있는 채널을 내렸다 — 0125 가 settings 축에서 못 박은 "해석 실패는 경계가 아니다" 가
// env 축에만 빠져 있었다.
describe('해석 실패 턴 (prepareUnresolvedHarnessConfig, r10)', () => {
  // **production 진입점을 그대로 부른다** — `turn-setup.ts` 의 `unresolvedPrepared` 가 이 함수를
  // 호출하는 한 줄이므로, 여기 단언이 곧 그 경로의 계약이다(D-055).
  const unresolved = (): ReturnType<typeof prepareHarnessConfig> =>
    prepareUnresolvedHarnessConfig({ appEnv: { APP_ONLY: 'kept' }, baseEnv: BASE })

  it('app env 는 그대로 실린다 — 0188 이전 subprocess env 와 같다', () => {
    const prepared = unresolved()
    expect(prepared.env?.APP_ONLY).toBe('kept')
    expect(prepared.env?.INHERITED).toBe('from-process')
  })

  it('fingerprint 를 내지 않는다 — respawn 판정에 "모른다" 를 넘긴다', () => {
    expect(unresolved().runtimeEnvFingerprint).toBeUndefined()
  })

  // 기본값이 바뀌면 정상 턴이 조용히 판정을 잃는다 — 그쪽이 훨씬 위험하다.
  it('기본값은 여전히 "해석했다" 다 — 정상 턴은 값을 낸다', () => {
    const prepared = prepareHarnessConfig({
      config: config({ runtimeEnv: { TOKEN: 't' } }),
      baseEnv: BASE
    })

    expect(prepared.runtimeEnvFingerprint).toBe(harnessEnvFingerprint(prepared.env))
  })
})

// ── 0190 정리 ────────────────────────────────────────────────────────────────

describe('fingerprint 는 한 번만 계산된다 (0190 AC1·AC2)', () => {
  // `SessionRuntime` 이 spawn 마다 다시 접지 않도록 조립부가 값을 함께 낸다. 두 필드는 값이
  // 같지만 축이 다르다 — 아래 두 테스트가 그 차이를 고정한다.
  it('해석한 턴에서는 두 필드가 같은 값이다', () => {
    const prepared = prepareHarnessConfig({
      config: config({ runtimeEnv: { TOKEN: 't' } }),
      baseEnv: BASE
    })

    expect(prepared.envFingerprint).toBe(harnessEnvFingerprint(prepared.env))
    expect(prepared.runtimeEnvFingerprint).toBe(prepared.envFingerprint)
  })

  // 여기서 `envFingerprint` 까지 undefined 로 만들면, 해석 실패 턴에 뜬 채널이 이후 **어떤 env
  // 변화에도 respawn 하지 않는다** — 비교의 양쪽 중 하나가 영구히 null 이 되기 때문이다.
  it('해석 못한 턴에서도 spawn 기록용 값은 실재한다', () => {
    const prepared = prepareUnresolvedHarnessConfig({
      appEnv: { APP_ONLY: 'kept' },
      baseEnv: BASE
    })

    expect(prepared.runtimeEnvFingerprint).toBeUndefined()
    expect(prepared.envFingerprint).toBe(harnessEnvFingerprint(prepared.env))
  })

  // `send.ts`/`continuation.ts` 는 `env` 를 얕은 복사해 싣는다. canonicalize 가 키를 정렬하므로
  // 복사본의 fingerprint 는 원본과 같아야 한다 — 다르면 매 턴 상시 respawn 이 된다.
  it('env 얕은 복사본의 fingerprint 가 원본과 같다', () => {
    const prepared = prepareHarnessConfig({
      config: config({ runtimeEnv: { B: '2', A: '1' } }),
      baseEnv: BASE
    })

    expect(harnessEnvFingerprint({ ...prepared.env })).toBe(prepared.envFingerprint)
  })
})

describe('같은 입력이면 같은 참조를 돌려준다 (0190 AC3·AC4)', () => {
  // `providerSettingsChangedSinceSpawn` 의 상시 경로는 참조 비교 1회다(0125). env 블록이 있는
  // 배포에서 조립이 매 턴 새 객체를 만들면 그 경로가 항상 빗나가 턴마다 stringify 2회로 간다.
  it('env 블록이 있어도 두 번째 조립이 같은 providerSettings 참조를 준다', () => {
    const source = settings({ TOKEN: 'from-settings' }, { model: 'sonnet' })
    const input = {
      config: config({ settings: source, runtimeEnv: { TOKEN: 'runtime' } }),
      baseEnv: BASE
    }

    const first = prepareHarnessConfig(input)
    const second = prepareHarnessConfig(input)

    expect(first.providerSettings).toBeDefined()
    expect(Object.is(first.providerSettings, second.providerSettings)).toBe(true)
    expect(Object.is(first.providerSettings!.settings, second.providerSettings!.settings)).toBe(
      true
    )
  })

  it('env 블록을 걷어낸 뒤에도 나머지 settings 는 보존된다', () => {
    const source = settings({ TOKEN: 'from-settings' }, { model: 'sonnet' })
    const prepared = prepareHarnessConfig({
      config: config({ settings: source, runtimeEnv: { TOKEN: 'runtime' } }),
      baseEnv: BASE
    })

    expect(prepared.providerSettings!.settings['model']).toBe('sonnet')
    expect(prepared.providerSettings!.settings['env']).toBeUndefined()
    // 디스크 사본은 건드리지 않는다.
    expect(source.settings['env']).toEqual({ TOKEN: 'from-settings' })
  })

  it('원본 blob 이 다르면 다른 참조를 준다 — 실제로 바뀐 턴은 계속 감지된다', () => {
    const runtimeEnv = { TOKEN: 'runtime' }
    const first = prepareHarnessConfig({
      config: config({ settings: settings({ TOKEN: 'a' }), runtimeEnv }),
      baseEnv: BASE
    })
    const second = prepareHarnessConfig({
      config: config({ settings: settings({ TOKEN: 'b' }), runtimeEnv }),
      baseEnv: BASE
    })

    expect(Object.is(first.providerSettings, second.providerSettings)).toBe(false)
  })

  // env 블록이 없으면 사본을 만들 이유가 없다 — 원본 참조가 그대로 나가야 한다.
  it('env 블록이 없으면 원본 ResolvedHarnessSettings 를 그대로 돌려준다', () => {
    const source = settings(undefined, { model: 'sonnet' })
    const prepared = prepareHarnessConfig({
      config: config({ settings: source, runtimeEnv: { TOKEN: 'runtime' } }),
      baseEnv: BASE
    })

    expect(Object.is(prepared.providerSettings, source)).toBe(true)
  })
})

// SDK 가 `options.settings` 와 `options.env` 중 어느 쪽을 우선하는지는 내부 구현이고 버전에
// 따라 바뀔 수 있다. 이 모듈의 계약은 **어느 쪽이 이기든 결과가 하나** 라는 것이고, 그것이
// 성립하는 이유는 같은 키가 두 채널에 동시에 남지 않기 때문이다. 0188 D-017 이 요구한 고정이다.
describe('두 채널 결정표 — characterization (0190 AC13)', () => {
  it('options.env 를 만드는 턴에는 settings 채널에 env 가 남지 않는다', () => {
    const prepared = prepareHarnessConfig({
      config: config({
        settings: settings({ SHARED: 'from-settings', ONLY_SETTINGS: 's' }),
        runtimeEnv: { SHARED: 'from-runtime' }
      }),
      baseEnv: BASE
    })

    expect(prepared.providerSettings!.settings['env']).toBeUndefined()
    expect(prepared.env?.SHARED).toBe('from-runtime')
    // hoist 는 충돌 키만이 아니라 블록 전체다 — 안 그러면 비충돌 키가 두 채널에 남는다.
    expect(prepared.env?.ONLY_SETTINGS).toBe('s')
  })

  it('options.env 를 만들지 않는 턴에는 settings 채널을 건드리지 않는다', () => {
    const source = settings({ TOKEN: 'from-settings' })
    const prepared = prepareHarnessConfig({
      config: config({ settings: source, runtimeEnv: {} }),
      baseEnv: BASE
    })

    expect(prepared.env).toBeUndefined()
    expect(Object.is(prepared.providerSettings, source)).toBe(true)
    expect(prepared.providerSettings!.settings['env']).toEqual({ TOKEN: 'from-settings' })
  })

  it('settings env 의 비문자열 값은 subprocess env 로 넘기지 않는다', () => {
    const prepared = prepareHarnessConfig({
      config: config({
        settings: settings({ STR: 'ok', NUM: 42, OBJ: { nested: true } }),
        runtimeEnv: { TOKEN: 't' }
      }),
      baseEnv: BASE
    })

    expect(prepared.env?.STR).toBe('ok')
    expect(prepared.env?.NUM).toBeUndefined()
    expect(prepared.env?.OBJ).toBeUndefined()
  })
})
