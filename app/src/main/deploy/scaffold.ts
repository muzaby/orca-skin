// 최초 부팅 스캐폴드 — provider settings 정규 소스(sources/settings/<adapter>/)가 비어 있으면
// 기본 provider(anthropic) 디렉토리와 어댑터 meta.json 을 생성한다 (ensureOrcaFile 과 동급의
// "사용자가 발견·편집할 수 있는 템플릿" 패턴, handoff 0014). 이미 provider 디렉토리가 하나라도
// 있으면 손대지 않는다 — 스캐폴드는 빈 상태 1회용이지 복구/동기화 장치가 아니다.
//
// settings.json 은 어댑터-네이티브 스키마(claude-code = Claude settings.json)다. bedrock/vertex 등
// 추가 provider 는 사용자가 디렉토리를 만들고 env 블록을 직접 작성한다 (TRD §6.8 레시피 표).

import { existsSync, mkdirSync, readdirSync, renameSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Backend } from '../../shared/ipc'
import { orcaConfigDir } from '../config/paths'

const DEFAULT_PROVIDER = 'anthropic'

// 기본 provider 의 settings.json 템플릿. env 는 ${VAR} 플레이스홀더(secret-store/process.env 로
// 확장) 또는 평문을 허용한다 — 비워두면 SDK 의 기존 인증(OAuth 등)으로 동작.
const SETTINGS_TEMPLATE = { env: {} }

// 어댑터당 1개 meta.json — provider 라벨/모델 목록(Orca 메타, dist 미배포). models 항목 스키마는
// settings/provider-settings.ts 의 OrcaModelSchema (구 orca.json agents[].models 와 동일).
const META_TEMPLATE = { [DEFAULT_PROVIDER]: { label: 'Anthropic', models: [] } }

function writeJsonAtomic(path: string, value: unknown): void {
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

  const scaffoldedDefault = !hasProviderDir(settingsDir)
  if (scaffoldedDefault) {
    const providerDir = join(settingsDir, DEFAULT_PROVIDER)
    mkdirSync(providerDir, { recursive: true })
    const settingsPath = join(providerDir, 'settings.json')
    if (!existsSync(settingsPath)) {
      writeJsonAtomic(settingsPath, SETTINGS_TEMPLATE)
      created.push(settingsPath)
    }
  }

  // meta.json 은 provider 디렉토리 유무와 무관하게 부재 시 생성 — 사용자가 디렉토리만 먼저
  // 만들었어도 라벨/모델을 채울 자리를 보장한다. 기존 파일은 절대 덮어쓰지 않는다.
  // 기본 provider 를 함께 만든 경우에만 그 엔트리를 채운다(없는 디렉토리 참조 경고 방지).
  const metaPath = join(settingsDir, 'meta.json')
  if (existsSync(settingsDir) && !existsSync(metaPath)) {
    writeJsonAtomic(metaPath, scaffoldedDefault ? META_TEMPLATE : {})
    created.push(metaPath)
  }

  return { created }
}
