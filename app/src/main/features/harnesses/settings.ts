// Harness native settings 해석 서비스 (0014 → 0017 D2 → 0188 이설).
// `sources/settings/<harness>/<modelProvider>/` 트리(열거는 `settings-entries.ts`)의
// Harness-네이티브 settings 를 로더로 해석해 캐시한다.
//
// Harness 일반화 시점: 본 모듈은 Harness-중립이다. 실제 settings 해석(SDK resolveSettings 등
// Harness 종속 어휘)은 주입된 `HarnessSettingsLoader` 가 담당한다 — claude 로더는
// `adapters/claude-settings.ts`, 미래 opencode 로더는 자기 포맷을 그대로 해석해 같은 blob 으로
// 돌려주면 된다 (정규화 0 — settings 스키마는 Harness-네이티브 그대로 흐른다).
//
// 캐시: key → {settings, mtimeMs}. sources 파일 mtime 변화 시 재해석, deploy 후
// `invalidateAll()`. 비밀 확장은 로더 내부(해석 시점)에서만 — 디스크/캐시 외부로 평문이
// 새지 않게 caller 는 blob 을 query 옵션 주입에만 쓴다.
//
// **배럴 re-export 를 두지 않는다 (0188).** 0017 이 분해하며 남긴 re-export 는 "이 파일이
// Harness 설정의 모든 것" 이라는 착시를 만들었다 — 소비처는 `models.ts`·`env.ts`·
// `settings-entries.ts`·`runtime-boundary.ts`·`adapters/harness-config.ts` 를 직접 import 한다.

import { stat } from 'node:fs/promises'
import { join } from 'node:path'
import { orcaConfigDir } from '../../infra/config/paths'
import { getLogger } from '../../infra/log/registry'
import { listAdapters, listProviders, type HarnessModelProviderEntry } from './settings-entries'
import type {
  HarnessNativeSettings,
  ResolvedHarnessSettings,
  HarnessSettingsLoader
} from '../../adapters/harness-config'

interface CacheEntry {
  settings: HarnessNativeSettings
  mtimeMs: number
  srcPath: string
}

export class HarnessSettingsService {
  private readonly cache = new Map<string, CacheEntry>()
  // 어댑터별 provider 열거 캐시 — list() 는 매 chat:send 마다 도므로 디스크 readdir+readFile+parse
  // 를 반복하지 않는다. provider 트리를 바꾸는 앱 경로(engine add/update/delete·deploy)가
  // invalidateAll() 로 비우므로 resolve() 의 mtime 캐시와 동일 수명 정책을 따른다.
  private readonly listCache = new Map<string, HarnessModelProviderEntry[]>()
  // 어댑터 디렉토리 열거 캐시 — listCache 와 동일 수명(invalidateAll 에서 함께 해제).
  private adaptersCache: string[] | null = null

  constructor(
    private readonly loaders: Record<string, HarnessSettingsLoader>,
    private readonly root: string = orcaConfigDir()
  ) {}

  adapters(): string[] {
    this.adaptersCache ??= listAdapters(this.root)
    return this.adaptersCache
  }

  list(adapter: string): HarnessModelProviderEntry[] {
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
  async resolve(entry: HarnessModelProviderEntry): Promise<ResolvedHarnessSettings | undefined> {
    const loader = this.loaders[entry.harnessId]
    if (!loader) return undefined

    const sourcesSettingsFile = join(
      this.root,
      'sources',
      'settings',
      entry.harnessId,
      entry.modelProviderId,
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
        provider: entry.modelProviderId,
        settings: hit.settings,
        sourceRevision: revisionOf(srcPath, mtimeMs)
      }
    }

    try {
      const { settings } = await loader({ sourcesSettingsFile })
      this.cache.set(entry.key, { settings, mtimeMs, srcPath })
      return {
        providerKey: entry.key,
        provider: entry.modelProviderId,
        settings,
        sourceRevision: revisionOf(srcPath, mtimeMs)
      }
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

// 해석 원천의 opaque revision (0188). **경로와 mtime 둘 다** 넣는다 — 경로만 보면 파일이 바뀐
// 것을 놓치고, mtime 만 보면 다른 entry 의 같은 mtime 과 충돌한다. 내용 해시를 쓰지 않는 이유는
// 기존 캐시 정책(mtime stat 1회)의 hot-path 비용을 늘리지 않기 위함이다.
function revisionOf(srcPath: string, mtimeMs: number): string {
  return `${srcPath}@${mtimeMs}`
}

// 매 chat:send 경유(resolveTurnProvider) — resolve() 가 이미 async 라 stat 도 비동기로(0110).
async function statMtime(path: string): Promise<number> {
  try {
    return (await stat(path)).mtimeMs
  } catch {
    return 0
  }
}
