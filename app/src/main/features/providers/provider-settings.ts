// Provider settings 해석 서비스 (handoff 0014; 0017 D2 분해 후 = "해석 서비스 + 계약 타입").
// sources/settings/<adapter>/ 트리(열거는 provider-registry.ts)의 어댑터-네이티브 settings 를 로더로 해석해 캐시한다.
//
// 어댑터 일반화 시점: 본 모듈은 어댑터-중립이다. 실제 settings 해석(SDK resolveSettings 등
// 어댑터 종속 어휘)은 주입된 ProviderSettingsLoader 가 담당한다 — claude 로더는
// adapters/claude-settings.ts, 미래 opencode 로더는 자기 포맷을 그대로 해석해 같은 blob 으로
// 돌려주면 된다 (정규화 0 — settings 스키마는 어댑터-네이티브 그대로 흐른다).
//
// 캐시: providerKey → {settings, mtimeMs}. sources 파일 mtime 변화 시 재해석, deploy 후
// invalidateAll(). 비밀 확장은 로더 내부(해석 시점)에서만 — 디스크/캐시 외부로 평문이
// 새지 않게 caller 는 blob 을 query 옵션 주입에만 쓴다.
//
// 0017 분해: 열거→provider-registry.ts · 모델 해석→model-resolve.ts · env 유틸→env-merge.ts.
// 호출처 무회귀를 위해 본 모듈이 그 3개를 배럴 re-export 한다(기존 import 경로 보존).

import { stat } from 'node:fs/promises'
import { join } from 'node:path'
import { orcaConfigDir } from '../../infra/config/paths'
import { getLogger } from '../../infra/log/registry'
import { listAdapters, listProviders, type ProviderEntry } from './provider-registry'

// ── 배럴 re-export (0017 분해 — 기존 import 경로 무회귀) ──────────────────────────────────
export {
  type ParsedModel,
  modelKey,
  modelNameForFamily,
  defaultModelFamily,
  resolveTitleModel,
  toAgentEnvironments
} from './model-resolve'
export {
  type ProviderEntry,
  listAdapters,
  listProviders,
  defaultProvider
} from './provider-registry'
export { expandEnvRecord, mergeEnvLayers } from './env-merge'
export { crossesProviderBoundary } from './provider-boundary'

// 계약 타입(ProviderSettings·ResolvedProviderSettings·ProviderSettingsLoader)은 어댑터 포트
// (`adapters/provider-config.ts`)로 이관됐다 — 어댑터가 도메인/feature 를 import 하지 않도록.
// 기존 import 경로 무회귀를 위해 여기서 re-export 하고, 서비스 내부용으로도 import 한다.
import type {
  ProviderSettings,
  ResolvedProviderSettings,
  ProviderSettingsLoader
} from '../../adapters/provider-config'
export type { ProviderSettings, ResolvedProviderSettings, ProviderSettingsLoader }

interface CacheEntry {
  settings: ProviderSettings
  mtimeMs: number
  srcPath: string
}

export class ProviderSettingsService {
  private readonly cache = new Map<string, CacheEntry>()
  // 어댑터별 provider 열거 캐시 — list() 는 매 chat:send 마다 도므로 디스크 readdir+readFile+parse
  // 를 반복하지 않는다. provider 트리를 바꾸는 앱 경로(engine add/update/delete·deploy)가
  // invalidateAll() 로 비우므로 resolve() 의 mtime 캐시와 동일 수명 정책을 따른다.
  private readonly listCache = new Map<string, ProviderEntry[]>()
  // 어댑터 디렉토리 열거 캐시 — listCache 와 동일 수명(invalidateAll 에서 함께 해제).
  private adaptersCache: string[] | null = null

  constructor(
    private readonly loaders: Record<string, ProviderSettingsLoader>,
    private readonly root: string = orcaConfigDir()
  ) {}

  adapters(): string[] {
    this.adaptersCache ??= listAdapters(this.root)
    return this.adaptersCache
  }

  list(adapter: string): ProviderEntry[] {
    const hit = this.listCache.get(adapter)
    if (hit) return hit
    const entries = listProviders(adapter, this.root)
    this.listCache.set(adapter, entries)
    return entries
  }

  // deploy 직후 호출 — sources/dist 정렬 작업 이후 캐시 전체 무효화.
  invalidateAll(): void {
    this.cache.clear()
    this.listCache.clear()
    this.adaptersCache = null
  }

  // entry 의 settings 를 해석해 blob 으로 반환. 로더 미등록 어댑터(미래 opencode 전 단계)는
  // undefined — caller 는 settings 없이 진행한다. 해석 실패도 동일(경고 후).
  async resolve(entry: ProviderEntry): Promise<ResolvedProviderSettings | undefined> {
    const loader = this.loaders[entry.adapter]
    if (!loader) return undefined

    const sourcesSettingsFile = join(
      this.root,
      'sources',
      'settings',
      entry.adapter,
      entry.provider,
      'settings.json'
    )
    // mtime 스테일 체크 — sources 파일 기준. 파일이 없으면 mtime 0
    // (빈 settings 캐시도 유효 — 파일 등장 시 mtime 변화로 재해석).
    const srcPath = sourcesSettingsFile
    const mtimeMs = await statMtime(srcPath)
    const hit = this.cache.get(entry.key)
    if (hit && hit.srcPath === srcPath && hit.mtimeMs === mtimeMs) {
      return {
        providerKey: entry.key,
        provider: entry.provider,
        settings: hit.settings
      }
    }

    try {
      const { settings } = await loader({ sourcesSettingsFile })
      this.cache.set(entry.key, { settings, mtimeMs, srcPath })
      return { providerKey: entry.key, provider: entry.provider, settings }
    } catch (err) {
      getLogger()
        .child('providers')
        .warn('providers.settings.resolve-failed', {
          providerKey: entry.key,
          message: String(err)
        })
      return undefined
    }
  }
}

// 매 chat:send 경유(resolveTurnProvider) — resolve() 가 이미 async 라 stat 도 비동기로(0110).
async function statMtime(path: string): Promise<number> {
  try {
    return (await stat(path)).mtimeMs
  } catch {
    return 0
  }
}
