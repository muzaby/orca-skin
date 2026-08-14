// Provider 열거 (handoff 0017 D2; settings-json-model-parser 로 meta.json 제거 후 재정의).
// sources/settings/<adapter>/ 트리(디렉토리 = SSOT)를 열거하고, 각 provider 의 settings.json 을
// claude/model-parser.ts 로 파싱해 모델 목록을 채운다. 더 이상 파생 캐시(meta.json)를 두지 않는다.

import { readdirSync, readFileSync, type Dirent } from 'node:fs'
import { join } from 'node:path'
import { isRecord } from '../../../shared/obj'
import { orcaConfigDir } from '../../infra/config/paths'
import { getLogger } from '../../infra/log/registry'
import { providerKeyOf, PROVIDER_NAME_RE } from '../../infra/config/provider-key'
import { parseClaudeModels, type ParsedModel } from './claude/model-parser'

// 열거된 provider 1건 (디렉토리 = SSOT, 모델은 settings.json 파싱 결과).
export interface ProviderEntry {
  key: string // `${adapter}-${provider}`
  adapter: string
  provider: string
  models: ParsedModel[]
}

// provider 의 settings.json 을 관용 파싱 → 모델 목록. 파일 부재/손상/비객체는 빈 설정({})으로
// 취급해 provider 가 여전히 기본 alias 목록으로 열거되게 한다(디렉토리 = 열거 SSOT 불변식).
function modelsForProvider(settingsFile: string): ParsedModel[] {
  let raw: string
  try {
    raw = readFileSync(settingsFile, 'utf8')
  } catch {
    return parseClaudeModels({})
  }
  let json: unknown
  try {
    json = JSON.parse(raw)
  } catch {
    getLogger().child('providers').warn('providers.settings.parse-failed', {
      path: settingsFile,
      fallback: 'default models'
    })
    return parseClaudeModels({})
  }
  if (!isRecord(json)) {
    getLogger().child('providers').warn('providers.settings.invalid', {
      path: settingsFile,
      reason: 'top-level value must be an object',
      fallback: 'default models'
    })
    return parseClaudeModels({})
  }
  return parseClaudeModels(json)
}

// sources/settings/ 의 어댑터 디렉토리 열거 — agent:list 가 미지원 어댑터(supported:false)도
// 노출할 수 있게 registry 가 아닌 디렉토리를 원천으로 한다.
export function listAdapters(root: string = orcaConfigDir()): string[] {
  try {
    return readdirSync(join(root, 'sources', 'settings'), { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
      .sort()
  } catch {
    return []
  }
}

// sources/settings/<adapter>/ 의 provider 디렉토리 열거 (이름순 정렬 — 결정적 기본 선택).
// 각 provider 의 settings.json 을 파싱해 모델 목록을 채운다.
export function listProviders(adapter: string, root: string = orcaConfigDir()): ProviderEntry[] {
  const settingsDir = join(root, 'sources', 'settings', adapter)
  let entries: Dirent[]
  try {
    entries = readdirSync(settingsDir, { withFileTypes: true })
  } catch {
    return []
  }
  return entries
    .filter((e) => e.isDirectory() && PROVIDER_NAME_RE.test(e.name))
    .map((e) => e.name)
    .sort()
    .map((provider) => ({
      key: providerKeyOf(adapter, provider),
      adapter,
      provider,
      models: modelsForProvider(join(settingsDir, provider, 'settings.json'))
    }))
}

// 기본 provider 선택 — 'anthropic' 우선, 없으면 이름순 첫 항목 (스캐폴드 기본값과 정합).
export function defaultProvider(entries: ProviderEntry[]): ProviderEntry | undefined {
  return entries.find((e) => e.provider === 'anthropic') ?? entries[0]
}
