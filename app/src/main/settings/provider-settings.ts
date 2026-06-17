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

import { statSync } from 'node:fs'
import { join } from 'node:path'
import { orcaConfigDir } from '../config/paths'
import { listAdapters, listProviders, type ProviderEntry } from './provider-registry'

// ── 배럴 re-export (0017 분해 — 기존 import 경로 무회귀) ──────────────────────────────────
export {
  type ParsedModel,
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

// 어댑터-네이티브 provider settings — Claude 의 경우 `~/.claude/settings.json` 과 동일 스키마다.
// env(auth key 등)를 포함할 수 있으며, 그대로 options.settings flag 레이어로 주입되어 사용자
// 전역 `~/.claude/settings.json` 을 덮어쓴다 (handoff 0028 — env↛argv 분리 폐기). settings 는
// dist 에 배포되지 않고 sources 파일만 읽으므로 디스크 평문은 늘지 않는다.
export type ProviderSettings = Record<string, unknown>

// 해석 완료된 provider settings — TurnRequest/CompleteRequest 로 어댑터에 전달되는 불투명 blob.
// 어댑터-네이티브 스키마(env 포함)를 그대로 담는다; 어댑터는 자기 query 옵션(claude=options.settings
// 인라인 JSON)에 꽂기만 한다 (handoff 0014; 0028 로 env↛argv split 폐기).
export interface ResolvedProviderSettings {
  providerKey: string
  provider: string
  settings: ProviderSettings
}

// 어댑터 종속 해석기 — 컴포지션 루트(ipc/router.ts)가 어댑터별로 주입한다. sources 파일을 읽어
// 어댑터-네이티브 settings 를 verbatim 으로 돌려준다 (claude=~/.claude/settings.json 동일 취급).
export type ProviderSettingsLoader = (args: {
  // sources/settings/<adapter>/<provider>/settings.json
  sourcesSettingsFile: string
}) => Promise<{ settings: ProviderSettings }>

interface CacheEntry {
  settings: ProviderSettings
  mtimeMs: number
  srcPath: string
}

export class ProviderSettingsService {
  private readonly cache = new Map<string, CacheEntry>()

  constructor(
    private readonly loaders: Record<string, ProviderSettingsLoader>,
    private readonly root: string = orcaConfigDir()
  ) {}

  adapters(): string[] {
    return listAdapters(this.root)
  }

  list(adapter: string): ProviderEntry[] {
    return listProviders(adapter, this.root)
  }

  // deploy 직후 호출 — sources/dist 정렬 작업 이후 캐시 전체 무효화.
  invalidateAll(): void {
    this.cache.clear()
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
    const mtimeMs = statMtime(srcPath)
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
