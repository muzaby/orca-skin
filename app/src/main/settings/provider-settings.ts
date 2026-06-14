// Provider settings 해석 서비스 (handoff 0014; 0017 D2 분해 후 = "해석 서비스 + 계약 타입").
// sources/settings/<adapter>/ 트리(열거는 provider-registry.ts)에서 dist/<adapter>/<provider>/ 에
// 배포된 어댑터-네이티브 settings 를 로더로 해석해 캐시한다.
//
// 어댑터 일반화 시점: 본 모듈은 어댑터-중립이다. 실제 settings 해석(SDK resolveSettings 등
// 어댑터 종속 어휘)은 주입된 ProviderSettingsLoader 가 담당한다 — claude-code 로더는
// adapters/claude-settings.ts, 미래 opencode 로더는 자기 포맷을 그대로 해석해 같은 blob 으로
// 돌려주면 된다 (정규화 0 — settings 스키마는 어댑터-네이티브 그대로 흐른다).
//
// 캐시: providerKey → {settings, mtimeMs}. dist 파일 mtime 변화 시 재해석, deploy 후
// invalidateAll(). 비밀 확장은 로더 내부(해석 시점)에서만 — 디스크/캐시 외부로 평문이
// 새지 않게 caller 는 blob 을 query 옵션 주입에만 쓴다.
//
// 0017 분해: 열거→provider-registry.ts · 모델 해석→model-resolve.ts · env 유틸→env-merge.ts.
// 호출처 무회귀를 위해 본 모듈이 그 3개를 배럴 re-export 한다(기존 import 경로 보존).

import { existsSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { orcaConfigDir } from '../config/paths'
import { type SecretReader } from '../config/provider-key'
import type { Resolver } from '../mcp/expand'
import { listAdapters, listProviders, type ProviderEntry } from './provider-registry'

// ── 배럴 re-export (0017 분해 — 기존 import 경로 무회귀) ──────────────────────────────────
export {
  OrcaModelSchema,
  type OrcaModelConfig,
  modelKey,
  modelNameForFamily,
  defaultModelFamily,
  toAgentEnvironments
} from './model-resolve'
export {
  type ProviderEntry,
  listAdapters,
  listProviders,
  defaultProvider
} from './provider-registry'
export { expandEnvRecord, mergeEnvLayers } from './env-merge'

// 해석 완료된 provider settings — TurnRequest/CompleteRequest 로 어댑터에 전달되는 불투명 blob.
// settings 와 env 를 **분리**한다 (handoff 0015): settings 는 어댑터-네이티브 스키마에서
// transport-env 를 뺀 것으로 flag 레이어(인라인 JSON 문자열)로 주입되고, env 는 ${VAR} 확장·
// secret 주입이 끝난 subprocess env 오버레이다 (argv 평문 비밀 노출 방지 — security.md 불변식).
export interface ResolvedProviderSettings {
  providerKey: string
  provider: string
  settings: Record<string, unknown>
  env: Record<string, string>
}

// 어댑터 종속 해석기 — 컴포지션 루트(ipc/router.ts)가 어댑터별로 주입한다. 반환은 settings 와
// subprocess env 의 분리 쌍 (handoff 0015) — opencode 로더도 자기 포맷에서 동일 분리를 결정한다.
export type ProviderSettingsLoader = (args: {
  providerKey: string
  provider: string
  // dist/<adapter>/<provider> (SDK resolveSettings 의 cwd)
  distProviderDir: string
  // sources/settings/<adapter>/<provider>/settings.json — dist 미배포 시 flat-read 폴백
  sourcesSettingsFile: string
  resolve: Resolver
  secrets?: SecretReader
}) => Promise<{ settings: Record<string, unknown>; env: Record<string, string> }>

interface CacheEntry {
  settings: Record<string, unknown>
  env: Record<string, string>
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
  // undefined — caller 는 settings 없이 진행한다(격리모드 유지). 해석 실패도 동일(경고 후).
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
        settings: hit.settings,
        env: hit.env
      }
    }

    try {
      const { settings, env } = await loader({
        providerKey: entry.key,
        provider: entry.provider,
        distProviderDir,
        sourcesSettingsFile,
        resolve: this.makeResolver(),
        secrets: this.secrets
      })
      this.cache.set(entry.key, { settings, env, mtimeMs, srcPath })
      return { providerKey: entry.key, provider: entry.provider, settings, env }
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
