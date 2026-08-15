// Harness spawn 입력 조립 (0188).
//
// ── 왜 이 조립이 필요한가 ────────────────────────────────────────────────────
// Harness 에는 **두 주입 채널**이 있다 — `options.settings`(Harness native settings JSON)와
// `options.env`(subprocess 환경변수). 0028 결정에 따라 secret 은 후자에만 실린다. 동적
// runtime config 가 생기면서 "같은 키가 두 채널에 모두 있을 때 무엇이 이기는가" 가 실제
// 실행 결과를 가르게 됐다.
//
// 적용 우선순위는 다음으로 **고정**한다:
//
// ```text
// runtime config augmenter env
//   > 선택된 Harness + ModelProvider settings 의 env
//   > app env
//   > 상속된 process env
// ```
//
// settings env 가 app env 를 이기는 것이 계약의 핵심이다 — `orca.json` 의 app env 는 **전역
// 폴백**이고 ModelProvider settings 는 **그 ModelProvider 전용 설정**이다. 폴백이 전용을 이기면
// 게이트웨이를 바꿔도 URL·모델 변수가 따라오지 않는다.
//
// ── SDK 우선순위와 이 모듈의 선택 ────────────────────────────────────────────
// `@anthropic-ai/claude-agent-sdk` 는 `options.settings` 를 **JSON 문자열**로 받고
// `options.env` 를 subprocess env 로 넘긴다. 두 채널의 env 충돌 시 어느 쪽이 이기는지는
// SDK/CLI 내부 구현에 달려 있고 버전에 따라 바뀔 수 있다.
//
// 그래서 **어느 쪽이 이기든 같은 결과가 나오도록** 조립한다(제안서 결정표 2행, fail-safe):
// `options.env` 를 만드는 턴에는 settings 의 **env 블록을 통째로** in-memory 사본에서 제거하고
// 그 값들을 위 순서로 `options.env` 에 hoist 한다. 두 채널에 같은 키가 동시에 남지 않으므로
// SDK 우선순위와 무관하게 결과가 하나다.
//
// `options.env` 를 만들지 않는 턴(정적 배포 + app env 없음)에는 settings 채널을 **건드리지
// 않는다** — 그 경로의 동작은 0188 이전과 글자까지 같다.
//
// **디스크 `settings.json` 은 수정하지 않는다** — 제거는 이 함수가 만든 사본에서만 일어난다.
//
// ── fingerprint ──────────────────────────────────────────────────────────────
// `providerSettingsChangedSinceSpawn` 만으로는 `options.env` 의 credential 교체를 판정하지
// 못한다(settings 는 그대로인데 토큰만 바뀌는 경우). 그 **한 축만** 메운다.
//
// **settings 를 함께 접지 않는다** (r2) — 그러면 `providerSettingsChanged` 와 판정이 겹치고,
// 0125 의 "해석 실패는 경계가 아니다" 를 조용히 뒤집는다. 근거는
// `adapters/harness-config.ts` 의 `harnessEnvFingerprint` 헤더.
//
// Harness+ModelProvider boundary·선택 Model·Runtime Tool revision 판정도 별도로 유지한다 —
// "전체 spawn fingerprint" 라는 이름 아래 중복하거나 기존 판정을 제거하지 않는다.
//
// **원문·secret·fingerprint 를 로그나 DB 에 남기지 않는다.**

import {
  harnessEnvFingerprint,
  type HarnessNativeSettings,
  type ResolvedHarnessSettings
} from '../../adapters/harness-config'
import type { HarnessRuntimeConfig } from './runtime-config'

export interface PreparedHarnessConfig {
  // 기존 `TurnRequest.providerSettings` 로 그대로 간다.
  providerSettings?: ResolvedHarnessSettings
  // 기존 `TurnRequest.env` 로 그대로 간다.
  env?: Readonly<Record<string, string>>
  // **최종 env 만** 정규화해 만든 메모리 전용 비교값이다 (r2 축소 — settings 차원은
  // `providerSettingsChangedSinceSpawn` 이 0125 의 보수적 null 의미론과 함께 계속 소유한다).
  //
  // `undefined` = **판정 불가** (r10). "env 가 비었다" 와 다르다 — 이번 턴이 실행 구성을
  // 해석하지 못했다는 뜻이고, 그 상태를 값으로 접으면 0125 가 settings 축에서 막은 것과 같은
  // 회귀가 env 축에서 난다: 해석에 실패한 턴마다 fingerprint 가 달라져 **살아 있는 채널을
  // 내리고 respawn** 한다. 판정 불가는 no-op 이어야 한다.
  runtimeEnvFingerprint: string | undefined
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

// settings blob 에서 `env` 블록을 통째로 걷어낸 **사본**을 만든다.
//
// **왜 충돌 키만이 아니라 전부인가 (r3 정정)**: r2 는 `runtimeEnv` 와 충돌하는 키만 지웠다.
// 그러면 settings 에도 app env 에도 있는 키가 **두 채널에 동시에** 남아 최종 값이 SDK 내부
// 우선순위에 달린다 — "어느 채널이 우선해도 같은 결과" 라는 이 모듈의 계약이 깨진다.
// options.env 를 만드는 턴에는 settings 의 env 를 전부 그리로 hoist 하고 이 채널에서는 비운다.
//
// env 블록이 없으면 원본 참조를 그대로 돌려준다 — 같은 참조여야
// `providerSettingsChangedSinceSpawn` 의 빠른 경로(참조 비교 1회)가 계속 성립한다.
function withoutEnvBlock(settings: HarnessNativeSettings): HarnessNativeSettings {
  if (!isRecord(settings['env'])) return settings
  const next = { ...settings }
  delete next['env']
  return next
}

// settings blob 의 env 블록에서 **문자열 값만** 뽑는다. Harness native settings 는 임의
// JSON 이라 숫자·객체가 들어올 수 있는데, subprocess env 는 문자열만 받는다.
function stringEnvOf(settings: HarnessNativeSettings | undefined): Record<string, string> {
  const env = settings?.['env']
  if (!isRecord(env)) return {}
  const out: Record<string, string> = {}
  for (const [key, value] of Object.entries(env)) {
    if (typeof value === 'string') out[key] = value
  }
  return out
}

export interface PrepareHarnessConfigInput {
  config: HarnessRuntimeConfig
  // orca.json 앱 전역 env(`${VAR}` 확장 완료). 없으면 앱 env 레이어가 비었다는 뜻.
  appEnv?: Record<string, string>
  // 완전한 baseline 을 만드는 함수(기본은 `process.env` 스냅샷). SDK `options.env` 는
  // subprocess env 를 **대체**하므로 overlay 만 넘기면 상속이 끊긴다.
  baseEnv: () => Record<string, string>
  // 이번 턴이 Harness+ModelProvider entry 를 실제로 골랐는가 (r10, 기본 `true`).
  //
  // `false` 면 env 는 조립하되 **fingerprint 를 내지 않는다** — respawn 판정에 "모른다" 를
  // 넘겨 보수적 no-op 이 되게 한다(0125 null 의미론과 같은 축). 값을 내면 해석 실패 턴마다
  // 채널이 내려간다.
  configResolved?: boolean
}

export function prepareHarnessConfig(input: PrepareHarnessConfigInput): PreparedHarnessConfig {
  const { config } = input
  const runtimeEnv = config.runtimeEnv
  const hasRuntimeEnv = Object.keys(runtimeEnv).length > 0
  const appEnv = input.appEnv ?? {}
  const hasAppEnv = Object.keys(appEnv).length > 0

  const settings = config.settings
  // 동적 값이 없고 앱 env 도 없으면 **옵션 자체를 생략**한다 — SDK 기본 env(process.env 상속)
  // 동작과 settings 채널을 그대로 둔다(구 `mergeEnvLayers` 의 의미, 정적 배포의 상시 경로).
  const buildsEnv = hasRuntimeEnv || hasAppEnv
  const adjusted =
    settings && buildsEnv ? { ...settings, settings: withoutEnvBlock(settings.settings) } : settings

  // ── 우선순위 (r3 정정) ────────────────────────────────────────────────────
  // 계약은 `runtimeEnv > settings env > app env > process env` 다. r2 는 app 을 settings 뒤에
  // 얹어 **app env 가 ModelProvider 의 URL·모델 변수를 덮었다** — 전역 폴백이 그 ModelProvider
  // 전용 설정을 이기는 것은 뒤집힌 관계다. 나중 spread 가 이기므로 순서가 곧 우선순위다.
  const env: Record<string, string> | undefined = buildsEnv
    ? {
        ...input.baseEnv(),
        ...appEnv,
        ...stringEnvOf(settings?.settings),
        ...runtimeEnv
      }
    : undefined

  return {
    ...(adjusted ? { providerSettings: adjusted } : {}),
    ...(env ? { env } : {}),
    runtimeEnvFingerprint: input.configResolved === false ? undefined : harnessEnvFingerprint(env)
  }
}

// Harness+ModelProvider entry 를 **못 고른** 턴의 spawn 입력 (r10).
//
// 조립 규칙을 호출부(`app/chat-turn/turn-setup.ts`)에 인라인으로 두지 않는 이유: 그 파일은
// electron 을 물어 vitest 가 import 하지 못한다. 규칙이 거기 있으면 이 경로는 **테스트가 닿지
// 않는 자리**가 되고, 실제로 r9 가 그렇게 두 가지를 놓쳤다 —
//
//   ① app env 유실. 0188 이전에는 `buildTurnEnv()` 가 entry 선택과 무관하게 불려 orca.json 의
//      `env` 가 항상 실렸다. 여기서 빠뜨리면 settings 트리가 없는 어댑터(DEV mock)나 sources
//      디렉터리가 잠깐 안 보이는 턴에서 subprocess 환경이 조용히 달라진다.
//   ② fingerprint 를 값으로 냄. `harnessEnvFingerprint(undefined)` 도 정의된 문자열이고
//      `SessionRuntime` 은 spawn 마다 그것을 기록하므로, 해석 실패 턴이 곧 "env 가 바뀌었다" 로
//      읽혀 **살아 있는 채널을 내리고 respawn** 했다. 0125 가 settings 축에서 "해석 실패는
//      경계가 아니다" 로 못 박은 것과 같은 자리다.
//
// 호출부에 남는 것은 인자 두 개를 넘기는 한 줄뿐이고, 그 형상은 타입이 잡는다.
export function prepareUnresolvedHarnessConfig(input: {
  appEnv?: Record<string, string>
  baseEnv: () => Record<string, string>
}): PreparedHarnessConfig {
  return prepareHarnessConfig({
    config: { key: '', harnessId: '', modelProviderId: '', runtimeEnv: {} },
    ...(input.appEnv ? { appEnv: input.appEnv } : {}),
    baseEnv: input.baseEnv,
    configResolved: false
  })
}

// fingerprint 의 SSOT 는 `adapters/harness-config.ts` 하나다 — spawn 기록부
// (`features/sessions/session-runtime.ts`)가 같은 함수를 써야 하고, feature 끼리는 교차
// import 가 금지된다. 여기서는 재수출만 한다.
export { harnessEnvFingerprint } from '../../adapters/harness-config'
