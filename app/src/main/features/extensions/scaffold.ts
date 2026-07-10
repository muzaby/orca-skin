// 최초 부팅 스캐폴드 — provider settings 정규 소스(sources/settings/<adapter>/)가 비어 있으면
// 기본 provider 디렉토리 + settings.json 을 생성한다 (ensureOrcaFile 과 동급의
// "사용자가 발견·편집할 수 있는 템플릿" 패턴, handoff 0014). 이미 provider 디렉토리가 하나라도
// 있으면 손대지 않는다 — 스캐폴드는 빈 상태 1회용이지 복구/동기화 장치가 아니다.
// 이 "빈 상태 1회" 조건이 곧 설치 후 첫 시작이며, 업데이트는 기존 디렉토리가 있어 제외된다.
//
// settings.json 은 어댑터-네이티브 스키마(claude = Claude settings.json)다. 사용자 전역
// `~/.claude/settings.json` 원문이 주어지면 그 env 로 provider 종류를 판별해 전문을
// verbatim 시딩하고(handoff 0090), 부재/파싱 실패면 anthropic 빈 템플릿으로 폴백한다.

import { existsSync, mkdirSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import type { Backend } from '../../../shared/ipc'
import { isRecord } from '../../../shared/obj'
import { classifyClaudeEnv } from '../../adapters/claude-settings'
import { orcaConfigDir } from '../../infra/config/paths'
import { writeJsonAtomic } from '../../infra/config/json-file'

const DEFAULT_PROVIDER = 'anthropic'

// 폴백 settings.json 템플릿. `~/.claude/settings.json` 과 동일 스키마/취급이다
// (handoff 0028) — env 에 auth key 등을 직접 적어 관리하고(Orca 는 ${VAR} 확장을 하지 않음),
// 비워두면 SDK 의 기존 인증(OAuth 등)으로 동작한다.
const SETTINGS_TEMPLATE = { env: {} }

function hasProviderDir(settingsDir: string): boolean {
  try {
    return readdirSync(settingsDir, { withFileTypes: true }).some((e) => e.isDirectory())
  } catch {
    return false
  }
}

interface Seed {
  provider: string
  settings: Record<string, unknown>
}

// 사용자 settings 원문 → 시딩할 provider 이름 + 내용. env 판별은 claude 어휘지만
// 현재 지원 어댑터가 claude 뿐이라 스캐폴드 전체가 claude 전제다 (호출부도 'claude' 고정).
function resolveSeed(userSettingsJson?: string | null): Seed {
  if (userSettingsJson) {
    try {
      const parsed: unknown = JSON.parse(userSettingsJson)
      if (isRecord(parsed)) {
        return { provider: classifyClaudeEnv(parsed), settings: parsed }
      }
    } catch {
      // 파싱 실패 — 아래 기본 템플릿으로 폴백
    }
  }
  return { provider: DEFAULT_PROVIDER, settings: SETTINGS_TEMPLATE }
}

export interface ScaffoldResult {
  created: string[]
}

// 멱등. 생성한 경로 목록을 돌려준다(부팅 로깅용). userSettingsJson 은 호출부가
// readUserClaudeSettings() 로 읽어 주입한다(부재 = null) — 테스트 주입 겸용.
export function scaffoldProviderSettings(
  adapter: Backend,
  root: string = orcaConfigDir(),
  userSettingsJson?: string | null
): ScaffoldResult {
  const created: string[] = []
  const settingsDir = join(root, 'sources', 'settings', adapter)

  if (!hasProviderDir(settingsDir)) {
    const seed = resolveSeed(userSettingsJson)
    const providerDir = join(settingsDir, seed.provider)
    mkdirSync(providerDir, { recursive: true })
    const settingsPath = join(providerDir, 'settings.json')
    if (!existsSync(settingsPath)) {
      writeJsonAtomic(settingsPath, seed.settings)
      created.push(settingsPath)
    }
  }

  return { created }
}
