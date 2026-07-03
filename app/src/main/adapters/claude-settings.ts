// claude provider settings 로더 — sources/settings/claude/<provider>/settings.json 을
// flat-read 한 뒤 escalating defaultMode 필터만 적용해 **verbatim** 으로 돌려준다.
// provider settings.json 은 `~/.claude/settings.json` 과 동일 스키마/취급이다 (handoff 0028):
// auth key 등은 사용자가 env 블록에 직접 적어 관리하고, env 는 options.settings flag 로 그대로
// 주입되어 사용자 전역 `~/.claude/settings.json` 을 덮어쓴다. Orca 고유의 ${VAR} 확장·secret-store
// 토큰 주입(구 0010/0015)은 폐지했다 — Claude 정책 그대로.
//
// provider settings 는 dist/.claude 로 배포하지 않으므로 sources 파일을 직접 읽는다.
// escalating defaultMode 제거는 SDK filterEscalatingDefaultMode 와 동등하게 수동 적용한다(권한은
// Orca 의 canUseTool 게이트가 담당 — env 와 무관, TRD §6.8).

import { existsSync, readFileSync } from 'node:fs'
import type { ProviderSettingsLoader } from './provider-config'

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

export const loadClaudeProviderSettings: ProviderSettingsLoader = async ({
  sourcesSettingsFile
}) => {
  // ~/.claude/settings.json 동일 취급 — env 포함 전체를 verbatim 으로 돌려준다(${VAR} 무변환).
  // 변환은 escalating defaultMode strip 뿐(권한 trust 필터, env 무관).
  return { settings: stripEscalatingDefaultMode(flatRead(sourcesSettingsFile) ?? {}) }
}
