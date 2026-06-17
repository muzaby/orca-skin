// Provider settings 해석 서비스 (handoff 0014; 0017 D2 분해 후 = "해석 서비스 + 계약 타입").
// sources/settings/<adapter>/ 트리(열거는 provider-registry.ts)의 어댑터-네이티브 settings 를 로더로 해석해 캐시한다.
//
// 어댑터 일반화 시점: 본 모듈은 어댑터-중립이다. 실제 settings 해석(SDK resolveSettings 등
// 어댑터 종속 어휘)은 주입된 ProviderSettingsLoader 가 담당한다 — claude-code 로더는
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
import { type SecretReader } from '../config/provider-key'
import type { Resolver } from '../mcp/expand'
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

// ── Branded(nominal) 비밀/직렬화 경계 타입 (handoff 0018) ─────────────────────────────────
// "비밀(env)↛argv" 불변식을 런타임 관례(delete settings.env + 주석)에서 **컴파일타임 타입**으로
// 격상한다 (security.md). 두 타입은 일반 Record 를 직접 대입할 수 없고(브랜드 미보유), 브랜딩은
// 오직 splitProviderSettings(아래 단일 신뢰 경계)에서만 일어난다. 브랜드는 phantom unique symbol
// 이라 런타임 속성 0 (직렬화·동등성 영향 없음).
declare const argvSafeBrand: unique symbol
declare const subprocessEnvBrand: unique symbol
// argv(--settings 인라인 JSON)로 안전한 설정 — env(평문 비밀 가능)가 제거된 것.
export type ArgvSafeSettings = Record<string, unknown> & { readonly [argvSafeBrand]: true }
// subprocess(spawn) env 로만 흐르는 env — ${VAR}/secret 확장 완료(평문 비밀 포함 가능).
export type SubprocessEnv = Record<string, string> & { readonly [subprocessEnvBrand]: true }

// 유일한 신뢰 경계(handoff 0018) — effective settings 에서 env 를 떼어내 settings/env 를 각각
// 브랜딩한다. 이 함수 밖에서는 ArgvSafeSettings/SubprocessEnv 브랜딩(=`as`)이 존재하지 않으므로,
// "env 머금은 객체를 argv 로 보내기"가 타입 단계에서 불가능해진다(Parse, don't validate).
// 모든 어댑터 로더(claude-code·미래 opencode)는 이 생성자를 통해서만 {settings, env} 를 만든다.
export function splitProviderSettings(
  effective: Record<string, unknown>,
  env: Record<string, string>
): { settings: ArgvSafeSettings; env: SubprocessEnv } {
  const settings: Record<string, unknown> = { ...effective }
  delete settings.env
  return { settings: settings as ArgvSafeSettings, env: env as SubprocessEnv }
}

// 해석 완료된 provider settings — TurnRequest/CompleteRequest 로 어댑터에 전달되는 불투명 blob.
// settings 와 env 를 **분리**한다 (handoff 0015; 0018 로 타입 브랜딩): settings(ArgvSafeSettings)는
// 어댑터-네이티브 스키마에서 transport-env 를 뺀 것으로 flag 레이어(인라인 JSON 문자열)로 주입되고,
// env(SubprocessEnv)는 ${VAR} 확장·secret 주입이 끝난 subprocess env 오버레이다 (argv 평문 비밀
// 노출 방지 — security.md 불변식, 이제 타입이 강제).
export interface ResolvedProviderSettings {
  providerKey: string
  provider: string
  settings: ArgvSafeSettings
  env: SubprocessEnv
}

// 어댑터 종속 해석기 — 컴포지션 루트(ipc/router.ts)가 어댑터별로 주입한다. 반환은 splitProviderSettings
// 가 만든 브랜디드 분리 쌍 (handoff 0015/0018) — opencode 로더도 같은 생성자를 통해야 한다.
export type ProviderSettingsLoader = (args: {
  providerKey: string
  provider: string
  // sources/settings/<adapter>/<provider>/settings.json
  sourcesSettingsFile: string
  resolve: Resolver
  secrets?: SecretReader
}) => Promise<{ settings: ArgvSafeSettings; env: SubprocessEnv }>

interface CacheEntry {
  settings: ArgvSafeSettings
  env: SubprocessEnv
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
        settings: hit.settings,
        env: hit.env
      }
    }

    try {
      const { settings, env } = await loader({
        providerKey: entry.key,
        provider: entry.provider,
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
