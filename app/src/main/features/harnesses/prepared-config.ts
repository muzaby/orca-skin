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
// ── SDK 우선순위 실측과 이 모듈의 선택 ───────────────────────────────────────
// `@anthropic-ai/claude-agent-sdk` 는 `options.settings` 를 **JSON 문자열**로 받고
// `options.env` 를 subprocess env 로 넘긴다. 두 채널의 env 충돌 시 어느 쪽이 이기는지는
// SDK/CLI 내부 구현에 달려 있고 버전에 따라 바뀔 수 있다.
//
// 그래서 **어느 쪽이 이기든 같은 결과가 나오도록** 조립한다(제안서 결정표 2행, fail-safe):
// settings 의 env 중 `runtimeEnv` 와 충돌하는 키를 **in-memory copy 에서 제거**하고, 최종
// `options.env` 를 `inherited → app → settings env → runtimeEnv` 순으로 만든다. 충돌 키가
// settings 채널에 남아 있지 않으므로 SDK 가 어느 쪽을 우선하든 결과가 하나다.
//
// **디스크 `settings.json` 은 수정하지 않는다** — 제거는 이 함수가 만든 사본에서만 일어난다.
//
// ── fingerprint ──────────────────────────────────────────────────────────────
// `providerSettingsChangedSinceSpawn` 만으로는 `options.env` 의 credential 교체를 판정하지
// 못한다(settings 는 그대로인데 토큰만 바뀌는 경우). 그래서 **실제 adapter 입력 두 개**를
// key 정렬 canonical form 으로 접어 비교값을 만든다.
//
// 이 값은 **env·settings 만의 비교값**이다. Harness+ModelProvider boundary·선택 Model·
// Runtime Tool revision 판정은 별도로 유지한다 — "전체 spawn fingerprint" 라는 이름 아래
// 중복하거나 기존 판정을 제거하지 않는다.
//
// **원문·secret·fingerprint 를 로그나 DB 에 남기지 않는다.**

import {
  harnessConfigFingerprint,
  type HarnessNativeSettings,
  type ResolvedHarnessSettings
} from '../../adapters/harness-config'
import type { HarnessRuntimeConfig } from './runtime-config'

export interface PreparedHarnessConfig {
  // 기존 `TurnRequest.providerSettings` 로 그대로 간다.
  providerSettings?: ResolvedHarnessSettings
  // 기존 `TurnRequest.env` 로 그대로 간다.
  env?: Readonly<Record<string, string>>
  // 위 두 **실제 adapter 입력만** 정규화해 만든 메모리 전용 비교값이다.
  runtimeConfigFingerprint: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

// settings blob 의 `env` 블록에서 동적 키와 충돌하는 것만 걷어낸 **사본**을 만든다.
// 충돌이 없으면 원본 참조를 그대로 돌려준다 — 같은 참조여야 `providerSettingsChangedSinceSpawn`
// 의 빠른 경로(참조 비교 1회)가 계속 성립한다.
function withoutConflictingEnv(
  settings: HarnessNativeSettings,
  runtimeEnv: Readonly<Record<string, string>>
): HarnessNativeSettings {
  const env = settings['env']
  if (!isRecord(env)) return settings
  const conflicting = Object.keys(env).filter((key) => key in runtimeEnv)
  if (conflicting.length === 0) return settings
  const nextEnv: Record<string, unknown> = { ...env }
  for (const key of conflicting) delete nextEnv[key]
  return { ...settings, env: nextEnv }
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
}

export function prepareHarnessConfig(input: PrepareHarnessConfigInput): PreparedHarnessConfig {
  const { config } = input
  const runtimeEnv = config.runtimeEnv
  const hasRuntimeEnv = Object.keys(runtimeEnv).length > 0
  const appEnv = input.appEnv ?? {}
  const hasAppEnv = Object.keys(appEnv).length > 0

  const settings = config.settings
  const adjusted =
    settings && hasRuntimeEnv
      ? { ...settings, settings: withoutConflictingEnv(settings.settings, runtimeEnv) }
      : settings

  // 동적 값이 없고 앱 env 도 없으면 **옵션 자체를 생략**한다 — SDK 기본 env(process.env 상속)
  // 동작을 그대로 유지한다(구 `mergeEnvLayers` 의 의미).
  const env: Record<string, string> | undefined =
    hasRuntimeEnv || hasAppEnv
      ? {
          ...input.baseEnv(),
          ...stringEnvOf(adjusted?.settings),
          ...appEnv,
          ...runtimeEnv
        }
      : undefined

  return {
    ...(adjusted ? { providerSettings: adjusted } : {}),
    ...(env ? { env } : {}),
    runtimeConfigFingerprint: harnessConfigFingerprint(adjusted?.settings, env)
  }
}

// fingerprint 의 SSOT 는 `adapters/harness-config.ts` 하나다 — spawn 기록부
// (`features/sessions/session-runtime.ts`)가 같은 함수를 써야 하고, feature 끼리는 교차
// import 가 금지된다. 여기서는 재수출만 한다.
export { harnessConfigFingerprint } from '../../adapters/harness-config'
