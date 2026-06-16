// claude-code provider settings 로더 — sources/settings/claude-code/<provider>/settings.json 을
// flat-read 한 뒤 escalating defaultMode 필터와 env 분리를 적용한다.
// 어댑터 종속 어휘(SDK API · ANTHROPIC_API_KEY · escalating 모드)는 이 파일 안에만 둔다.
//
// provider settings 는 dist/.claude 로 배포하지 않으므로 sources 파일을 직접 읽는다.
// escalating defaultMode 제거는 SDK filterEscalatingDefaultMode 와 동등하게 수동 적용한다.
//
// env 후처리(해석 시점에만 — 디스크/캐시 외부 평문 0):
//   1. settings.env 값의 ${VAR} 확장 (미해결 키는 드롭 + 경고 — claude-env.ts 의 구 정책 계승)
//   2. secret-store `provider:${providerKey}` 토큰이 있으면 env.ANTHROPIC_API_KEY 로 주입
//      (UI 로 저장한 토큰이 계속 동작 — handoff 0010 키 규약 유지)
//
// 반환은 {settings, env} 분리 쌍 (handoff 0015): settings 는 effective 에서 env 를 뺀 것(flag
// 레이어 인라인 JSON 으로 argv 노출 — 비밀 불가), env 는 subprocess env 로 따로 흐른다.

import { existsSync, readFileSync } from 'node:fs'
import type { ProviderSettingsLoader } from '../settings/provider-settings'
import { expandEnvRecord, splitProviderSettings } from '../settings/provider-settings'

// CLI 가 repo-커밋 파일의 escalating 모드에 적용하는 trust 필터와 동등한 목록
// (sdk.d.ts resolveSettings remarks). flat 폴백 경로에서 수동 적용한다.
const ESCALATING_MODES = new Set(['bypassPermissions', 'acceptEdits', 'auto'])

type SettingsObject = Record<string, unknown>

function flatRead(path: string): SettingsObject | undefined {
  if (!existsSync(path)) return undefined
  try {
    const parsed = JSON.parse(readFileSync(path, 'utf8')) as unknown
    if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
      return parsed as SettingsObject
    }
  } catch (err) {
    console.warn(`[claude-settings] settings.json 파싱 실패 — 무시: ${path}`, err)
  }
  return undefined
}

function stripEscalatingDefaultMode(settings: SettingsObject): SettingsObject {
  const permissions = settings.permissions
  if (
    typeof permissions === 'object' &&
    permissions !== null &&
    typeof (permissions as SettingsObject).defaultMode === 'string' &&
    ESCALATING_MODES.has((permissions as SettingsObject).defaultMode as string)
  ) {
    const rest: SettingsObject = { ...(permissions as SettingsObject) }
    delete rest.defaultMode
    return { ...settings, permissions: rest }
  }
  return settings
}

function envRecordOf(settings: SettingsObject): Record<string, string> {
  const env = settings.env
  if (typeof env !== 'object' || env === null || Array.isArray(env)) return {}
  const out: Record<string, string> = {}
  for (const [key, value] of Object.entries(env)) {
    if (typeof value === 'string') out[key] = value
  }
  return out
}

export const loadClaudeProviderSettings: ProviderSettingsLoader = async ({
  providerKey,
  sourcesSettingsFile,
  resolve,
  secrets
}) => {
  const effective = stripEscalatingDefaultMode(flatRead(sourcesSettingsFile) ?? {})

  const { env, missing } = expandEnvRecord(envRecordOf(effective), resolve)
  if (missing.length > 0) {
    console.warn(
      `[claude-settings] '${providerKey}' 미해결 환경변수로 일부 env 키를 건너뜀: ${missing.join(', ')}`
    )
  }
  const token = secrets?.get(`provider:${providerKey}`)
  if (token !== undefined && token.trim() !== '') env.ANTHROPIC_API_KEY = token

  // settings 와 env 를 분리·브랜딩한다 (handoff 0015 분리 · 0018 타입 격상). splitProviderSettings
  // 단일 신뢰 경계가 effective 에서 env 키를 제거(미확장 ${VAR}·평문 비밀이 settings→argv 로 새지
  // 않게)하고 ArgvSafeSettings/SubprocessEnv 로 브랜딩한다 — 여기서 ad-hoc 분리는 더 이상 없다.
  return splitProviderSettings(effective, env)
}
