// spawn 입력 조립 — env 우선순위·secret 격리·fingerprint (0188 AC15·AC16·AC19).
//
// 0181 의 `buildTurnEnv` 는 `orca.json env + materialize().env` 두 층만 병합했다. 여기서는
// spawn env 레이어(process → app → settings env → runtimeEnv → 배포 custom, 0207)의 최종 값과,
// 그 값이 respawn 판정에 쓰이는 fingerprint 로 접히는지를 본다.

import { describe, expect, it } from 'vitest'
import {
  harnessEnvFingerprint,
  prepareHarnessConfig,
  prepareUnresolvedHarnessConfig,
  type HarnessRuntimeConfig,
  type ResolvedHarnessSettings,
  type SpawnEnvInjector,
  type SpawnEnvTarget
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
  it('customEnv > runtimeEnv > settings env > app env > process env', () => {
    const prepared = prepareHarnessConfig({
      config: config({
        settings: settings({ LAYER: 'settings', ONLY_SETTINGS: 's' }),
        runtimeEnv: { LAYER: 'runtime' }
      }),
      appEnv: { LAYER: 'app', ONLY_APP: 'a' },
      baseEnv: BASE,
      customEnv: () => ({ LAYER: 'custom', ONLY_CUSTOM: 'c' })
    })

    expect(prepared.env?.LAYER).toBe('custom')
    expect(prepared.env?.ONLY_CUSTOM).toBe('c')
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

  // 위에서부터 한 층씩 걷어내며 같은 표에서 최종값을 관측한다 — 키마다 참여 레이어가 하나씩
  // 줄어드는 형태라, 순서가 어긋나면 "값이 있다" 가 아니라 **어느 값인가** 에서 깨진다.
  it('상대 순서가 계약과 같다 — custom > runtime > settings > app > process', () => {
    const prepared = prepareHarnessConfig({
      config: config({
        settings: settings({ A: 'settings', B: 'settings', C: 'settings' }),
        runtimeEnv: { A: 'runtime', B: 'runtime' }
      }),
      appEnv: { A: 'app', B: 'app', C: 'app', D: 'app' },
      baseEnv: () => ({ A: 'process', B: 'process', C: 'process', D: 'process', E: 'process' }),
      customEnv: () => ({ A: 'custom' })
    })

    expect(prepared.env).toMatchObject({
      A: 'custom', // 모든 레이어가 충돌 → custom
      B: 'runtime', // custom 을 걷어내면 → runtime
      C: 'settings', // runtime 까지 걷어내면 → settings
      D: 'app', // settings 까지 걷어내면 → app
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

describe('host-managed provider spawn env (0200)', () => {
  const MANAGED = 'CLAUDE_CODE_PROVIDER_MANAGED_BY_HOST'

  it('settings-only host-managed 구성은 provider env 전체를 subprocess env 로 hoist 한다', () => {
    const source = settings(
      {
        [MANAGED]: '1',
        ANTHROPIC_BASE_URL: 'https://settings.example.test',
        ANTHROPIC_AUTH_TOKEN: 'settings-token',
        ANTHROPIC_MODEL: 'settings-model',
        UNAFFECTED_FLAG: 'kept'
      },
      { model: 'native-setting' }
    )
    const prepared = prepareHarnessConfig({ config: config({ settings: source }), baseEnv: BASE })

    expect(prepared.env).toMatchObject({
      [MANAGED]: '1',
      ANTHROPIC_BASE_URL: 'https://settings.example.test',
      ANTHROPIC_AUTH_TOKEN: 'settings-token',
      ANTHROPIC_MODEL: 'settings-model',
      UNAFFECTED_FLAG: 'kept',
      INHERITED: 'from-process'
    })
    expect(prepared.providerSettings?.settings).not.toHaveProperty('env')
    expect(prepared.providerSettings?.settings).toMatchObject({ model: 'native-setting' })
  })

  it('runtimeEnv 의 host-managed provider 값이 하위 레이어 충돌에서 최종값이 된다', () => {
    const prepared = prepareHarnessConfig({
      config: config({
        settings: settings({
          [MANAGED]: '1',
          ANTHROPIC_BASE_URL: 'https://settings.example.test',
          ANTHROPIC_AUTH_TOKEN: 'settings-token',
          ANTHROPIC_MODEL: 'settings-model'
        }),
        runtimeEnv: {
          [MANAGED]: '1',
          ANTHROPIC_BASE_URL: 'https://runtime.example.test',
          ANTHROPIC_AUTH_TOKEN: 'runtime-token',
          ANTHROPIC_MODEL: 'runtime-model'
        }
      }),
      appEnv: {
        [MANAGED]: '0',
        ANTHROPIC_BASE_URL: 'https://app.example.test',
        ANTHROPIC_AUTH_TOKEN: 'app-token',
        ANTHROPIC_MODEL: 'app-model'
      },
      baseEnv: () => ({
        [MANAGED]: '0',
        ANTHROPIC_BASE_URL: 'https://process.example.test',
        ANTHROPIC_AUTH_TOKEN: 'process-token',
        ANTHROPIC_MODEL: 'process-model'
      })
    })

    expect(prepared.env).toMatchObject({
      [MANAGED]: '1',
      ANTHROPIC_BASE_URL: 'https://runtime.example.test',
      ANTHROPIC_AUTH_TOKEN: 'runtime-token',
      ANTHROPIC_MODEL: 'runtime-model'
    })
    expect(prepared.providerSettings?.settings).not.toHaveProperty('env')
  })

  it('process env 의 host-managed flag 도 settings provider env 를 hoist 한다', () => {
    let reads = 0
    const prepared = prepareHarnessConfig({
      config: config({
        settings: settings({ ANTHROPIC_BASE_URL: 'https://settings.example.test' })
      }),
      baseEnv: () => {
        reads += 1
        return { [MANAGED]: '1', PATH: '/usr/bin' }
      }
    })

    expect(reads).toBe(1)
    expect(prepared.env).toMatchObject({
      [MANAGED]: '1',
      ANTHROPIC_BASE_URL: 'https://settings.example.test'
    })
    expect(prepared.providerSettings?.settings).not.toHaveProperty('env')
  })

  it('host-managed flag 판정은 custom > runtime > settings > app > process 순서다', () => {
    const lower = {
      config: config({
        settings: settings({ [MANAGED]: '1', ANTHROPIC_BASE_URL: 'https://settings.test' }),
        runtimeEnv: { [MANAGED]: '0' }
      }),
      appEnv: { [MANAGED]: '1' },
      baseEnv: () => ({ [MANAGED]: '1' })
    }

    // custom 이 없으면 runtime 의 명시적 `0` 이 하위 `1` 을 계속 덮는다(0200 무회귀).
    expect(prepareHarnessConfig(lower).env?.[MANAGED]).toBe('0')

    // **양방향으로 본다.** 지우는 변이만 보면 형제 슬롯끼리 맞바꾼 결함이 통과한다.
    expect(
      prepareHarnessConfig({ ...lower, customEnv: () => ({ [MANAGED]: '1' }) }).env?.[MANAGED]
    ).toBe('1')
    expect(
      prepareHarnessConfig({
        ...lower,
        config: config({
          settings: settings({ [MANAGED]: '1' }),
          runtimeEnv: { [MANAGED]: '1' }
        }),
        customEnv: () => ({ [MANAGED]: '0' })
      }).env?.[MANAGED]
    ).toBe('0')
  })

  // AC12 — injector 만으로 host-managed 모드가 켜지고, 그 결과 settings env 가 hoist 된다.
  it('injector 의 host-managed flag 가 settings-only 정적 배포에서 hoist 를 켠다', () => {
    const source = settings({ ANTHROPIC_BASE_URL: 'https://settings.test' })
    const prepared = prepareHarnessConfig({
      config: config({ settings: source }),
      baseEnv: BASE,
      customEnv: () => ({ [MANAGED]: '1' })
    })

    expect(prepared.env).toMatchObject({
      [MANAGED]: '1',
      ANTHROPIC_BASE_URL: 'https://settings.test'
    })
    expect(prepared.providerSettings?.settings).not.toHaveProperty('env')
  })

  it('정확히 1이 아닌 settings-only flag 는 host-managed fast path 를 켜지 않는다', () => {
    const source = settings({ [MANAGED]: 'true', ANTHROPIC_BASE_URL: 'https://settings.test' })
    const prepared = prepareHarnessConfig({ config: config({ settings: source }), baseEnv: BASE })

    expect(prepared.env).toBeUndefined()
    expect(prepared.providerSettings).toBe(source)
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
  it('injector 를 그대로 부르되 resolved:false 로 알린다 — 사내 프록시가 빠지지 않는다', () => {
    const seen: SpawnEnvTarget[] = []
    const prepared = prepareUnresolvedHarnessConfig({
      baseEnv: BASE,
      customEnv: ({ target }) => {
        seen.push(target)
        return { HTTPS_PROXY: 'http://proxy.corp' }
      }
    })

    expect(seen).toEqual([{ resolved: false }])
    expect(prepared.env?.HTTPS_PROXY).toBe('http://proxy.corp')
    // 그래도 respawn 판정에는 "모른다" 를 넘긴다 — 해석 실패는 경계가 아니다(0125).
    expect(prepared.runtimeEnvFingerprint).toBeUndefined()
    expect(prepared.envFingerprint).toEqual(expect.any(String))
  })

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

// ── 배포 spawn env injector (0207) ───────────────────────────────────────────
//
// 조립부는 injector 를 **인자로** 받는다(`adapters → app` import 금지). 그래서 여기서는 배포
// 모듈을 흉내 낼 필요 없이 함수 하나를 넘겨 입력·출력·순서를 직접 관측한다.
describe('배포 spawn env injector (0207)', () => {
  // AC1 — 등록은 key 를 가리지 않는다. augmenter 가 못 하던 것이 이것이다.
  it('어느 key 든 injector 반환값이 최종 env 에 있다', () => {
    const injector: SpawnEnvInjector = () => ({ CORP_CA_BUNDLE: '/etc/corp/ca.pem' })
    const forKey = (key: string): Record<string, string> | undefined =>
      prepareHarnessConfig({
        config: config({ key, modelProviderId: key }),
        baseEnv: BASE,
        customEnv: injector
      }).env

    expect(forKey('claude-anthropic')?.CORP_CA_BUNDLE).toBe('/etc/corp/ca.pem')
    expect(forKey('claude-corp')?.CORP_CA_BUNDLE).toBe('/etc/corp/ca.pem')
  })

  // AC2 — 좁히기는 조립부가 아니라 함수 안에서 한다.
  it('injector 가 식별자로 좁히면 그 key 만 값이 바뀐다', () => {
    const narrowed: SpawnEnvInjector = ({ target }): Record<string, string> =>
      target.resolved && target.key === 'claude-corp' ? { CORP_ONLY: '1' } : {}
    const prepare = (
      key: string,
      customEnv?: SpawnEnvInjector
    ): ReturnType<typeof prepareHarnessConfig> =>
      prepareHarnessConfig({
        config: config({ key, settings: settings({ BASE_KEY: 'v' }), runtimeEnv: { R: 'r' } }),
        baseEnv: BASE,
        ...(customEnv ? { customEnv } : {})
      })

    expect(prepare('claude-corp', narrowed).env?.CORP_ONLY).toBe('1')
    // 대상 밖 key 는 **미등록 조립과 글자까지 같다** — 값이 빠졌는지가 아니라 결과가 같은지를 본다.
    expect(prepare('claude-anthropic', narrowed).env).toEqual(prepare('claude-anthropic').env)
  })

  // AC3 — 하드코딩이 config API 응답을 덮는 것이 D-003 의 의도된 결과다(§17 리스크).
  it('injector 값이 augmenter runtimeEnv 를 이긴다', () => {
    const prepared = prepareHarnessConfig({
      config: config({ runtimeEnv: { ANTHROPIC_BASE_URL: 'https://runtime.test' } }),
      baseEnv: BASE,
      customEnv: () => ({ ANTHROPIC_BASE_URL: 'https://corp-gateway.test' })
    })

    expect(prepared.env?.ANTHROPIC_BASE_URL).toBe('https://corp-gateway.test')
  })

  // AC5 — host env 는 `process.env` 스냅샷 한 장이고, 판정·조립과 **같은** 스냅샷이다.
  it('injector 는 baseEnv 가 낸 스냅샷을 hostEnv 로 받고 그것에서 값을 파생할 수 있다', () => {
    let seen: Readonly<Record<string, string>> | undefined
    const prepared = prepareHarnessConfig({
      config: config(),
      baseEnv: BASE,
      customEnv: ({ hostEnv }) => {
        seen = hostEnv
        return { DERIVED_PATH: `${hostEnv['PATH']}:/opt/corp/bin` }
      }
    })

    expect(seen).toEqual(BASE())
    expect(prepared.env?.DERIVED_PATH).toBe('/usr/bin:/opt/corp/bin')
  })

  // AC6 — 식별자 3종 + `settings.json` **원문 blob**. env 블록을 걷어내기 전 값이어야 배포가
  // 운영자 설정을 읽고 대상을 판별할 수 있다.
  it('injector 는 key·harnessId·modelProviderId 와 env 블록이 남은 settings 원문을 받는다', () => {
    const source = settings({ TOKEN: 'from-settings' }, { model: 'native' })
    let seen: SpawnEnvTarget | undefined
    prepareHarnessConfig({
      config: config({ settings: source, runtimeEnv: { R: 'r' } }),
      baseEnv: BASE,
      customEnv: ({ target }) => {
        seen = target
        return {}
      }
    })

    expect(seen).toEqual({
      resolved: true,
      key: 'claude-corp',
      harnessId: 'claude',
      modelProviderId: 'corp',
      settings: { env: { TOKEN: 'from-settings' }, model: 'native' }
    })
  })

  // AC7·VP-12 — injector 만으로 env 가 생긴 턴도 두 채널 결정표를 그대로 따른다.
  it('injector 만으로 값이 생긴 턴도 settings 의 env 블록을 통째로 hoist 한다', () => {
    const source = settings({ TOKEN: 'from-settings' }, { model: 'native' })
    const prepared = prepareHarnessConfig({
      config: config({ settings: source }),
      baseEnv: BASE,
      customEnv: () => ({ HTTPS_PROXY: 'http://proxy.corp' })
    })

    expect(prepared.env).toMatchObject({
      HTTPS_PROXY: 'http://proxy.corp',
      TOKEN: 'from-settings'
    })
    expect(prepared.providerSettings?.settings).not.toHaveProperty('env')
    expect(prepared.providerSettings?.settings).toMatchObject({ model: 'native' })
    // 디스크 원본은 그대로다 — 제거는 사본에서만 일어난다.
    expect(source.settings['env']).toEqual({ TOKEN: 'from-settings' })
  })

  // AC9·AC10 — 미등록과 빈 반환은 **같은 결과**다. 참조까지 같아야 상시 경로의 참조 비교가 산다.
  it('미등록과 빈 객체 반환은 env 를 만들지 않고 같은 settings 참조를 유지한다', () => {
    const source = settings({ TOKEN: 'from-settings' })
    const cases = [undefined, () => ({})] as const

    for (const customEnv of cases) {
      const prepared = prepareHarnessConfig({
        config: config({ settings: source }),
        baseEnv: BASE,
        ...(customEnv ? { customEnv } : {})
      })

      expect(prepared.env).toBeUndefined()
      expect(Object.is(prepared.providerSettings, source)).toBe(true)
    }
  })

  // AC11 — injector 값이 달라지면 살아 있는 채널을 내리고 respawn 해야 한다.
  it('injector 결과가 달라지면 envFingerprint 가 달라진다', () => {
    const withValue = (value: string): string =>
      prepareHarnessConfig({
        config: config({ runtimeEnv: { R: 'r' } }),
        baseEnv: BASE,
        customEnv: () => ({ CORP_GATEWAY: value })
      }).envFingerprint

    expect(withValue('https://a.test')).not.toBe(withValue('https://b.test'))
    expect(withValue('https://a.test')).toBe(withValue('https://a.test'))
  })

  // AC15 — injector 가 낸 secret 도 `options.env` 에만 남는다(0028 경계 유지).
  it('injector 가 낸 token 은 options.settings 로 복제되지 않는다', () => {
    const source = settings({ KEEP: 'yes' }, { model: 'native' })
    const prepared = prepareHarnessConfig({
      config: config({ settings: source }),
      baseEnv: BASE,
      customEnv: () => ({ CORP_TOKEN: 'super-secret' })
    })

    expect(prepared.env?.CORP_TOKEN).toBe('super-secret')
    expect(JSON.stringify(prepared.providerSettings?.settings)).not.toContain('super-secret')
    expect(JSON.stringify(source.settings)).not.toContain('super-secret')
  })

  // VP-20 — 판정·조립·injector 입력이 **같은 순간**의 process.env 를 본다.
  it('injector 가 등록돼도 baseEnv 는 한 번만 불린다', () => {
    let reads = 0
    prepareHarnessConfig({
      config: config({ settings: settings({ S: 's' }), runtimeEnv: { R: 'r' } }),
      appEnv: { A: 'a' },
      baseEnv: () => {
        reads += 1
        return BASE()
      },
      customEnv: () => ({ C: 'c' })
    })

    expect(reads).toBe(1)
  })

  // VP-08 — 상호배타 상태를 flat flag 로 두면 배포가 빈 문자열 key 를 실제 key 로 오인한다.
  // 그 조합은 타입에 존재하지 않는다.
  it('SpawnEnvTarget 은 discriminated union 이다 — resolved:false 갈래에 식별자가 없다', () => {
    const unresolved: SpawnEnvTarget = { resolved: false }

    // @ts-expect-error entry 를 못 고른 턴에는 key 가 없다 — 빈 문자열조차 넘기지 않는다.
    expect(unresolved.key).toBeUndefined()
    // @ts-expect-error 같은 이유로 harnessId 도 없다.
    expect(unresolved.harnessId).toBeUndefined()
  })
})
