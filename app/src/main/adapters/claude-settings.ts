// claude-code provider settings 로더 (handoff 0014) — dist/claude-code/<provider>/.claude/
// settings.json 을 SDK resolveSettings(CLI 와 동일 머지 엔진)로 해석해 effective 객체를 만든다.
// 어댑터 종속 어휘(SDK API · ANTHROPIC_API_KEY · escalating 모드)는 이 파일 안에만 둔다.
//
// resolveSettings/filterEscalatingDefaultMode 는 @alpha API 라 시그니처 변동 가능 — 함수 부재
// 시 flat JSON.parse 폴백 1경로를 유지한다(패키지가 'latest' 지정). 폴백에서도 escalating
// defaultMode 제거는 수동으로 동등 적용한다.
//
// env 후처리(해석 시점에만 — 디스크/캐시 외부 평문 0):
//   1. settings.env 값의 ${VAR} 확장 (미해결 키는 드롭 + 경고 — claude-env.ts 의 구 정책 계승)
//   2. secret-store `provider:${providerKey}` 토큰이 있으면 env.ANTHROPIC_API_KEY 로 주입
//      (UI 로 저장한 토큰이 계속 동작 — handoff 0010 키 규약 유지)
//
// 반환은 {settings, env} 분리 쌍 (handoff 0015): settings 는 effective 에서 env 를 뺀 것(flag
// 레이어 인라인 JSON 으로 argv 노출 — 비밀 불가), env 는 subprocess env 로 따로 흐른다.

import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import * as sdk from '@anthropic-ai/claude-agent-sdk'
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
  distProviderDir,
  sourcesSettingsFile,
  resolve,
  secrets
}) => {
  const distFile = join(distProviderDir, '.claude', 'settings.json')
  let effective: SettingsObject

  if (typeof sdk.resolveSettings === 'function' && existsSync(distFile)) {
    // SDK 머지 엔진 경로 — project 소스(<cwd>/.claude/settings.json) 단독 + 정책 티어
    // (managed 는 settingSources 와 무관하게 항상 읽힌다 — 의도된 동작, 정책 준수).
    const resolved = await sdk.resolveSettings({
      cwd: distProviderDir,
      settingSources: ['project']
    })
    effective =
      typeof sdk.filterEscalatingDefaultMode === 'function'
        ? (sdk.filterEscalatingDefaultMode(resolved) as SettingsObject)
        : stripEscalatingDefaultMode(resolved.effective as SettingsObject)
  } else {
    // flat 폴백 — dist 우선, 미배포(부팅 후 추가된 provider 등)면 sources 직접 읽기.
    effective = stripEscalatingDefaultMode(
      flatRead(distFile) ?? flatRead(sourcesSettingsFile) ?? {}
    )
  }

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
