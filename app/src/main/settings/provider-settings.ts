// Provider settings 서비스 (handoff 0014) — sources/settings/<adapter>/ 트리를 열거하고,
// dist/<adapter>/<provider>/ 에 배포된 어댑터-네이티브 settings 를 로더로 해석해 캐시한다.
//
// 어댑터 일반화 시점: 본 모듈은 어댑터-중립이다. 실제 settings 해석(SDK resolveSettings 등
// 어댑터 종속 어휘)은 주입된 ProviderSettingsLoader 가 담당한다 — claude-code 로더는
// adapters/claude-settings.ts, 미래 opencode 로더는 자기 포맷을 그대로 해석해 같은 blob 으로
// 돌려주면 된다 (정규화 0 — settings 스키마는 어댑터-네이티브 그대로 흐른다).
//
// 캐시: providerKey → {settings, env, mtimeMs}. dist 파일 mtime 변화 시 재해석, deploy 후
// invalidateAll(). 비밀 확장은 로더 내부(해석 시점)에서만 — caller 는 해석된 env 를
// query options.env 로만 주입하고 settings blob 자체는 query 옵션으로 넘기지 않는다.

import { existsSync, readdirSync, readFileSync, statSync, type Dirent } from 'node:fs'
import { join } from 'node:path'
import { z } from 'zod'
import type { AgentEnvironment, AgentModelView } from '../../shared/ipc'
import { orcaConfigDir } from '../config/paths'
import { providerKeyOf, type SecretReader } from '../config/provider-key'
import type { Resolver } from '../mcp/expand'
import { expandVars } from '../mcp/expand'

// 모델 항목 스키마 — 구 orca.json agents[].models 와 동일 (handoff 0010). 이제는
// sources/settings/<adapter>/meta.json 의 provider 별 models 가 원천이다.
export const OrcaModelSchema = z.object({
  name: z.string().min(1),
  family: z.string().optional(),
  default: z.boolean().optional()
})
export type OrcaModelConfig = z.infer<typeof OrcaModelSchema>

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

// 해석 완료된 provider settings — TurnRequest/CompleteRequest 로 어댑터에 전달된다.
// env 는 어댑터 로더가 settings.json 에서 추출·확장·secret 주입까지 끝낸 값이며,
// claude-code 어댑터는 query options.env 로만 전달한다. settings 는 캐시/진단용 원본 effective
// 객체일 뿐 query options.settings 로 다루지 않는다.
export interface ResolvedProviderSettings {
  providerKey: string
  provider: string
  env?: Record<string, string>
  settings: Record<string, unknown>
}

// 어댑터 종속 해석기 — 컴포지션 루트(ipc/router.ts)가 어댑터별로 주입한다.
export type ProviderSettingsLoader = (args: {
  providerKey: string
  provider: string
  // dist/<adapter>/<provider> (SDK resolveSettings 의 cwd)
  distProviderDir: string
  // sources/settings/<adapter>/<provider>/settings.json — dist 미배포 시 flat-read 폴백
  sourcesSettingsFile: string
  resolve: Resolver
  secrets?: SecretReader
}) => Promise<Record<string, unknown>>

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

// ── 모델 해석 (구 config/provider-key.ts 에서 이전 — meta.json models 기준) ──────────────

export function modelKey(model: OrcaModelConfig): string {
  return model.family ?? model.name
}

export function modelNameForFamily(
  models: OrcaModelConfig[],
  family: string | null | undefined
): string | undefined {
  if (models.length === 0) return undefined
  const wanted = family?.trim()
  const byFamily = wanted
    ? models.find((model) => modelKey(model) === wanted || model.name === wanted)
    : undefined
  const selected = byFamily ?? models.find((model) => model.default) ?? models[0]
  return selected?.name
}

export function defaultModelFamily(models: OrcaModelConfig[]): string | null {
  if (models.length === 0) return null
  const selected = models.find((model) => model.default) ?? models[0]
  return selected ? modelKey(selected) : null
}

// orca:agent:list 페이로드 — shape 는 handoff 0010 과 동일 유지 (renderer ModelMenu 변경 0).
export function toAgentEnvironments(
  entries: ProviderEntry[],
  supportedAdapters: Iterable<string>
): AgentEnvironment[] {
  const supported = new Set(supportedAdapters)
  return entries.map((entry) => ({
    key: entry.key,
    adapter: entry.adapter,
    provider: entry.provider,
    supported: supported.has(entry.adapter),
    models: entry.models.map(
      (model): AgentModelView => ({
        name: model.name,
        ...(model.family ? { family: model.family } : {}),
        ...(model.default !== undefined ? { default: model.default } : {})
      })
    )
  }))
}

// ── env 유틸 (구 adapters/claude-env.ts 에서 이전 — 어댑터-중립이라 여기로) ────────────────

// env 레코드의 각 값에서 ${VAR} 확장. 미해결 변수가 있는 키는 **드롭** + missing 으로 보고
// (조용한 빈 문자열 치환 금지 — mcp/expand.ts 와 동일 정책).
export function expandEnvRecord(
  env: Record<string, string>,
  resolve: Resolver
): { env: Record<string, string>; missing: string[] } {
  const out: Record<string, string> = {}
  const missing = new Set<string>()
  for (const [key, value] of Object.entries(env)) {
    const before = new Set(missing)
    const expanded = expandVars(value, resolve, missing)
    const unresolved = [...missing].some((name) => !before.has(name))
    if (!unresolved) out[key] = expanded
  }
  return { env: out, missing: [...missing] }
}

function envRecordOf(settings: Record<string, unknown>): Record<string, string> {
  const env = settings.env
  if (typeof env !== 'object' || env === null || Array.isArray(env)) return {}
  const out: Record<string, string> = {}
  for (const [key, value] of Object.entries(env)) {
    if (typeof value === 'string') out[key] = value
  }
  return out
}

function processEnvRecord(): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [key, value] of Object.entries(process.env)) {
    if (value !== undefined) out[key] = value
  }
  return out
}

// SDK Options.env 는 subprocess env 전체를 대체하므로, overlay 가 있으면 완전한 베이스
// (base 또는 process.env 스냅샷) 위에 병합한다. overlay 없으면 base 그대로 (undefined 포함).
export function mergeEnvLayers(
  base: Record<string, string> | undefined,
  overlay: Record<string, string>
): Record<string, string> | undefined {
  if (Object.keys(overlay).length === 0) return base
  return { ...(base ?? processEnvRecord()), ...overlay }
}

// ── 해석 서비스 (캐시 + 로더 위임) ─────────────────────────────────────────────────────────

interface CacheEntry {
  settings: Record<string, unknown>
  env?: Record<string, string>
  mtimeMs: number
  srcPath: string
}

export class ProviderSettingsService {
  private readonly cache = new Map<string, CacheEntry>()

  constructor(
    private readonly loaders: Record<string, ProviderSettingsLoader>,
    private readonly makeResolver: () => Resolver,
    private readonly secrets?: SecretReader,
    private readonly root: string = orcaConfigDir()
  ) {}

  adapters(): string[] {
    return listAdapters(this.root)
  }

  list(adapter: string): ProviderEntry[] {
    return listProviders(adapter, this.root)
  }

  // deploy 직후 호출 — dist 재렌더로 캐시 전체 무효화.
  invalidateAll(): void {
    this.cache.clear()
  }

  // entry 의 settings 를 해석해 blob 으로 반환. 로더 미등록 어댑터(미래 opencode 전 단계)는
  // undefined — caller 는 provider env 없이 SDK 기본 설정 정책으로 진행한다. 해석 실패도 동일(경고 후).
  async resolve(entry: ProviderEntry): Promise<ResolvedProviderSettings | undefined> {
    const loader = this.loaders[entry.adapter]
    if (!loader) return undefined

    const distProviderDir = join(this.root, 'dist', entry.adapter, entry.provider)
    const distFile = join(distProviderDir, '.claude', 'settings.json')
    const sourcesSettingsFile = join(
      this.root,
      'sources',
      'settings',
      entry.adapter,
      entry.provider,
      'settings.json'
    )
    // mtime 스테일 체크 — dist 우선, 없으면 sources 폴백 경로 기준. 둘 다 없으면 mtime 0
    // (빈 settings 캐시도 유효 — 파일 등장 시 mtime 변화로 재해석).
    const srcPath = existsSync(distFile) ? distFile : sourcesSettingsFile
    const mtimeMs = statMtime(srcPath)
    const hit = this.cache.get(entry.key)
    if (hit && hit.srcPath === srcPath && hit.mtimeMs === mtimeMs) {
      return {
        providerKey: entry.key,
        provider: entry.provider,
        ...(hit.env ? { env: hit.env } : {}),
        settings: hit.settings
      }
    }

    try {
      const settings = await loader({
        providerKey: entry.key,
        provider: entry.provider,
        distProviderDir,
        sourcesSettingsFile,
        resolve: this.makeResolver(),
        secrets: this.secrets
      })
      const env = envRecordOf(settings)
      const resolved = {
        providerKey: entry.key,
        provider: entry.provider,
        ...(Object.keys(env).length > 0 ? { env } : {}),
        settings
      }
      this.cache.set(entry.key, {
        settings,
        ...(resolved.env ? { env: resolved.env } : {}),
        mtimeMs,
        srcPath
      })
      return resolved
    } catch (err) {
      console.warn(
        `[provider-settings] '${entry.key}' settings 해석 실패 — settings 없이 진행:`,
        err
      )
      return undefined
    }
  }
}

function statMtime(path: string): number {
  try {
    return statSync(path).mtimeMs
  } catch {
    return 0
  }
}
