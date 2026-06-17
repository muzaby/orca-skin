// 최초 부팅 스캐폴드 — provider settings 정규 소스(sources/settings/<adapter>/)가 비어 있으면
// 기본 provider(anthropic) 디렉토리 + settings.json 템플릿을 생성한다 (ensureOrcaFile 과 동급의
// "사용자가 발견·편집할 수 있는 템플릿" 패턴, handoff 0014). 이미 provider 디렉토리가 하나라도
// 있으면 손대지 않는다 — 스캐폴드는 빈 상태 1회용이지 복구/동기화 장치가 아니다.
//
// settings.json 은 어댑터-네이티브 스키마(claude = Claude settings.json)다. bedrock/vertex 등
// 추가 provider 는 사용자가 디렉토리를 만들고 env 블록을 직접 작성한다 (TRD §6.8 레시피 표).

import { existsSync, mkdirSync, readdirSync, renameSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Backend } from '../../shared/ipc'
import { orcaConfigDir } from '../config/paths'

const DEFAULT_PROVIDER = 'anthropic'

// 기본 provider 의 settings.json 템플릿. `~/.claude/settings.json` 과 동일 스키마/취급이다
// (handoff 0028) — env 에 auth key 등을 직접 적어 관리하고(Orca 는 ${VAR} 확장을 하지 않음),
// 비워두면 SDK 의 기존 인증(OAuth 등)으로 동작한다.
const SETTINGS_TEMPLATE = { env: {} }

export function writeJsonAtomic(path: string, value: unknown): void {
  const tmp = `${path}.tmp`
  writeFileSync(tmp, JSON.stringify(value, null, 2) + '\n', 'utf8')
  renameSync(tmp, path)
}

function hasProviderDir(settingsDir: string): boolean {
  try {
    return readdirSync(settingsDir, { withFileTypes: true }).some((e) => e.isDirectory())
  } catch {
    return false
  }
}

export interface ScaffoldResult {
  created: string[]
}

// 멱등. 생성한 경로 목록을 돌려준다(부팅 로깅용).
export function scaffoldProviderSettings(
  adapter: Backend,
  root: string = orcaConfigDir()
): ScaffoldResult {
  const created: string[] = []
  const settingsDir = join(root, 'sources', 'settings', adapter)

  if (!hasProviderDir(settingsDir)) {
    const providerDir = join(settingsDir, DEFAULT_PROVIDER)
    mkdirSync(providerDir, { recursive: true })
    const settingsPath = join(providerDir, 'settings.json')
    if (!existsSync(settingsPath)) {
      writeJsonAtomic(settingsPath, SETTINGS_TEMPLATE)
      created.push(settingsPath)
    }
  }

  return { created }
}
