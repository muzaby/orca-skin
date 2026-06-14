// Provider 열거 (handoff 0017 D2 분해 — 구 provider-settings.ts 의 "provider 열거" 책임).
// sources/settings/<adapter>/ 트리(디렉토리 = SSOT)를 열거하고 meta.json(부가 정보)을 머지한다.

import { readdirSync, readFileSync, type Dirent } from 'node:fs'
import { join } from 'node:path'
import { z } from 'zod'
import { orcaConfigDir } from '../config/paths'
import { providerKeyOf } from '../config/provider-key'
import { OrcaModelSchema, type OrcaModelConfig } from './model-resolve'

const MetaEntrySchema = z.object({
  label: z.string().optional(),
  models: z.array(OrcaModelSchema).optional()
})

// 열거된 provider 1건 (디렉토리 = SSOT, meta.json 은 부가 정보).
export interface ProviderEntry {
  key: string // `${adapter}-${provider}`
  adapter: string
  provider: string
  label?: string
  models: OrcaModelConfig[]
}

// meta.json 관용 파싱 — 파일 부재/손상은 {} (provider 열거에 영향 없음), 항목 단위 위반은
// 해당 provider 만 드롭 (orca-file.ts 3단 관용 패턴).
function readMeta(metaPath: string): Record<string, z.infer<typeof MetaEntrySchema>> {
  let raw: string
  try {
    raw = readFileSync(metaPath, 'utf8')
  } catch {
    return {}
  }
  let json: unknown
  try {
    json = JSON.parse(raw)
  } catch {
    console.warn(`[provider-settings] meta.json 파싱 실패 — 무시: ${metaPath}`)
    return {}
  }
  if (typeof json !== 'object' || json === null || Array.isArray(json)) {
    console.warn('[provider-settings] meta.json 최상위는 객체여야 합니다 — 무시')
    return {}
  }
  const out: Record<string, z.infer<typeof MetaEntrySchema>> = {}
  for (const [provider, candidate] of Object.entries(json)) {
    const parsed = MetaEntrySchema.safeParse(candidate)
    if (parsed.success) out[provider] = parsed.data
    else console.warn(`[provider-settings] meta.json '${provider}' 항목 드롭 (스키마 위반)`)
  }
  return out
}

const PROVIDER_NAME_RE = /^[A-Za-z0-9_-]+$/

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
// meta.json 에만 있고 디렉토리가 없는 키는 경고 후 무시한다.
export function listProviders(adapter: string, root: string = orcaConfigDir()): ProviderEntry[] {
  const settingsDir = join(root, 'sources', 'settings', adapter)
  let entries: Dirent[]
  try {
    entries = readdirSync(settingsDir, { withFileTypes: true })
  } catch {
    return []
  }
  const meta = readMeta(join(settingsDir, 'meta.json'))
  const dirs = entries
    .filter((e) => e.isDirectory() && PROVIDER_NAME_RE.test(e.name))
    .map((e) => e.name)
    .sort()
  for (const key of Object.keys(meta)) {
    if (!dirs.includes(key)) {
      console.warn(`[provider-settings] meta.json '${key}' 는 provider 디렉토리가 없어 무시`)
    }
  }
  return dirs.map((provider) => {
    const m = meta[provider]
    return {
      key: providerKeyOf(adapter, provider),
      adapter,
      provider,
      ...(m?.label ? { label: m.label } : {}),
      models: m?.models ?? []
    }
  })
}

// 기본 provider 선택 — 'anthropic' 우선, 없으면 이름순 첫 항목 (스캐폴드 기본값과 정합).
export function defaultProvider(entries: ProviderEntry[]): ProviderEntry | undefined {
  return entries.find((e) => e.provider === 'anthropic') ?? entries[0]
}
