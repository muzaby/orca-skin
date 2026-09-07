// Harness native settings 해석 서비스 (0014 → 0017 D2 → 0188 이설).
// `sources/settings/<harness>/<modelProvider>/` 트리의
// Harness-네이티브 settings 를 로더로 해석해 캐시한다.
//
// settings blob 해석은 주입된 `HarnessSettingsLoader` 가 담당한다. 소스 열거의 모델 목록은
// 현재 Claude 파서를 사용하며, blob 자체는 Harness-네이티브 스키마 그대로 흐른다.
//
// 캐시: key → {settings, mtimeMs}. sources 파일 mtime 변화 시 재해석, deploy 후
// `invalidateAll()`. 비밀 확장은 로더 내부(해석 시점)에서만 — 디스크/캐시 외부로 평문이
// 새지 않게 caller 는 blob 을 query 옵션 주입에만 쓴다.
//
// 소스 열거와 해석 캐시는 이 모듈이 소유한다. 모델 선택·env·spawn 경계 판정은 각각의
// 순수 모듈이 소유하며 여기서 re-export하지 않는다.

import { stat } from 'node:fs/promises'
import { readdirSync, readFileSync, type Dirent } from 'node:fs'
import { join } from 'node:path'
import { isRecord } from '../../../shared/obj'
import { providerKeyOf, PROVIDER_NAME_RE } from '../../infra/config/provider-key'
import { parseClaudeModels, type ParsedModel } from './claude/model-parser'
import { orcaConfigDir } from '../../infra/config/paths'
import { getLogger } from '../../infra/log/registry'
import type {
  HarnessNativeSettings,
  ResolvedHarnessSettings,
  HarnessSettingsLoader
} from '../../adapters/harness-config'
import { errorMessage } from '../../infra/errors'

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
  async resolve(
    entry: Pick<HarnessModelProviderEntry, 'key' | 'harnessId' | 'modelProviderId'>
  ): Promise<ResolvedHarnessSettings | undefined> {
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
    const mtimeMs = await statMtime(sourcesSettingsFile)
    const hit = this.cache.get(entry.key)
    if (hit && hit.srcPath === sourcesSettingsFile && hit.mtimeMs === mtimeMs) {
      return {
        providerKey: entry.key,
        provider: entry.modelProviderId,
        settings: hit.settings,
        sourceRevision: revisionOf(sourcesSettingsFile, mtimeMs)
      }
    }

    try {
      const { settings } = await loader({ sourcesSettingsFile })
      this.cache.set(entry.key, { settings, mtimeMs, srcPath: sourcesSettingsFile })
      return {
        providerKey: entry.key,
        provider: entry.modelProviderId,
        settings,
        sourceRevision: revisionOf(sourcesSettingsFile, mtimeMs)
      }
    } catch (err) {
      getLogger()
        .child('providers')
        .warn('providers.settings.resolve-failed', {
          providerKey: entry.key,
          message: errorMessage(err)
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

// 열거된 Harness + ModelProvider 1건 (디렉토리 = SSOT, 모델은 settings.json 파싱 결과).
//
// **별도 definition 배열이 아니다** (0188 D-013) — 이 타입은 디렉터리 열거 결과의 형상일 뿐이고,
// 선택 가능한 목록의 SSOT 는 계속 파일시스템이다.
export interface HarnessModelProviderEntry {
  key: string // `${harnessId}-${modelProviderId}`
  harnessId: string
  modelProviderId: string
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
export function listProviders(
  adapter: string,
  root: string = orcaConfigDir()
): HarnessModelProviderEntry[] {
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
      harnessId: adapter,
      modelProviderId: provider,
      models: modelsForProvider(join(settingsDir, provider, 'settings.json'))
    }))
}
