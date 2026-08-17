// Harness 실행 구성 (0188 — 구 `features/providers/llm/`).
//
// ── 이 모듈이 푸는 문제 ───────────────────────────────────────────────────────
// 0181 의 `Provider.llm = { adapter, provider, envKey }` 는 **credential 한 값**만 표현했다.
// `materialize()` 가 vault 값을 그 envKey 하나에 넣는 것이 전부였다. 폐쇄망에서는 OAuth 로
// 받은 토큰이 실제 LLM token 이 아닐 수 있고, 그 토큰으로 config API 를 한 번 더 불러 받은
// **URL·모델 식별자·실행 token 을 한꺼번에** Harness 환경변수로 바꿔야 한다.
//
// ── 하지만 두 번째 플랫폼을 만들지 않는다 ────────────────────────────────────
// 선택 가능한 Harness+ModelProvider 목록과 Model 목록의 SSOT 는 **여전히
// `sources/settings/<harness>/<modelProvider>/` 디렉터리**다(`settings-entries.ts`).
// `RuntimeConfigAugmenters` 는 catalog 가 아니다 — entry 를 열거하지도 선택하지도 않고,
// **이미 선택된 key 에 동적 보강 코드가 있는지만** 조회한다. 매핑에 key 가 없으면 기존
// settings 와 app env 만으로 동작하며 network 는 0이다.
//
// ── 왜 cache 에 generation 이 필요한가 ────────────────────────────────────────
// 재인증 중에 시작된 옛 config 요청이 무효화 **뒤에** 완료되면 낡은 token 이 cache 로 되살아
// 난다. 그 경우 fingerprint 도 옛 값과 같아 persistent runtime 이 stale subprocess 를 그대로
// 재사용한다 — 조용히 죽은 토큰으로 계속 돌게 된다. 그래서 세대 fence 가 선택이 아니다.
//
// 세대를 cache **key** 로 쌓지 않는다(`Map<generation, value>` 금지) — 이전 secret 이 메모리에
// 남는다. key 당 **현재 세대 하나**만 들고 있는다.
//
// 레이어: features/harnesses → contracts·adapters·infra·shared. fs·network 는 주입받는다.

import type {
  HarnessModelProviderKey,
  HarnessRuntimeConfig,
  ResolvedHarnessSettings
} from '../../adapters/harness-config'

// `HarnessModelProviderKey`·`HarnessRuntimeConfig` 는 **adapter 입력의 형상**이라 계약 자리
// (`adapters/harness-config.ts`)가 정본이다(0190). 이 슬라이스는 그것을 해석해 채울 뿐이고,
// 기존 소비자를 위해 여기서 다시 export 한다.
export type { HarnessModelProviderKey, HarnessRuntimeConfig }

// settings 디렉터리가 확정한 좌표. **새 definition 배열이 아니다** — 열거 결과의 부분집합이다.
export interface HarnessModelProviderEntry {
  key: HarnessModelProviderKey
  harnessId: string
  modelProviderId: string
}

// 배포가 구현하는 유일한 확장점. **endpoint·JSON path·모델 매핑을 DSL 로 만들지 않는다** —
// 배포별 TypeScript 함수가 응답을 직접 해석한다.
export interface RuntimeConfigAugmenter {
  resolve(
    input: {
      key: HarnessModelProviderKey
      settings?: ResolvedHarnessSettings
    },
    signal?: AbortSignal
  ): Promise<{
    runtimeEnv: Readonly<Record<string, string>>
    validUntil?: number
  }>
}

export type RuntimeConfigAugmenters = Readonly<
  Partial<Record<HarnessModelProviderKey, RuntimeConfigAugmenter>>
>

export interface HarnessRuntimeConfigService {
  resolve(entry: HarnessModelProviderEntry, signal?: AbortSignal): Promise<HarnessRuntimeConfig>
  // key 미지정 = 전부. `reason` 은 진단 로그용이다.
  invalidate(key?: HarnessModelProviderKey, reason?: string): void
}

// settings 해석 포트. 구조적으로 받아 `HarnessSettingsService` 와 타입 결합을 만들지 않는다
// (`src/main/AGENTS.md §해소책 2`).
export interface HarnessSettingsPort {
  resolve(entry: HarnessModelProviderEntry): Promise<ResolvedHarnessSettings | undefined>
}

// `validUntil` 판정의 안전 여유. 시계 오차와 요청 왕복을 고려해 만료 직전 값을 warm hit 로
// 돌려주지 않는다.
const EXPIRY_SKEW_MS = 30_000

// stale 세대 재시도 상한. 재인증이 연속으로 들어오면 재시도가 무한이 될 수 있다 —
// 소진하면 명시적 오류로 끝낸다(조용한 옛 값 반환 금지).
const MAX_STALE_RETRIES = 2

export class StaleHarnessConfigError extends Error {
  constructor(readonly key: HarnessModelProviderKey) {
    super(`harness runtime config for "${key}" was invalidated while resolving`)
    this.name = 'StaleHarnessConfigError'
  }
}

// key 하나의 **현재 세대 상태**. 세대가 바뀌면 통째로 버린다.
interface KeyState {
  generation: number
  cached?: { config: HarnessRuntimeConfig; sourceRevision: string }
  inFlight?: {
    generation: number
    sourceRevision: string
    controller: AbortController
    promise: Promise<HarnessRuntimeConfig>
  }
}

export interface CreateHarnessRuntimeConfigServiceDeps {
  settings: HarnessSettingsPort
  augmenters?: RuntimeConfigAugmenters
  clock?: () => number
  logger?: (event: string, data: Record<string, unknown>) => void
}

export function createHarnessRuntimeConfigService(
  deps: CreateHarnessRuntimeConfigServiceDeps
): HarnessRuntimeConfigService {
  const clock = deps.clock ?? Date.now
  const augmenters = deps.augmenters ?? {}
  const states = new Map<HarnessModelProviderKey, KeyState>()

  const stateFor = (key: HarnessModelProviderKey): KeyState => {
    const existing = states.get(key)
    if (existing) return existing
    const created: KeyState = { generation: 0 }
    states.set(key, created)
    return created
  }

  const usable = (config: HarnessRuntimeConfig): boolean =>
    config.validUntil === undefined || config.validUntil - EXPIRY_SKEW_MS > clock()

  // settings 를 해석하고 필요하면 augmenter 를 태운다. **여기서는 cache 를 만지지 않는다** —
  // 세대 검사는 호출부(`resolve`)가 완료 시점에 한다.
  const compute = async (
    entry: HarnessModelProviderEntry,
    settings: ResolvedHarnessSettings | undefined,
    signal: AbortSignal
  ): Promise<HarnessRuntimeConfig> => {
    const augmenter = augmenters[entry.key]
    const base: HarnessRuntimeConfig = {
      key: entry.key,
      harnessId: entry.harnessId,
      modelProviderId: entry.modelProviderId,
      ...(settings ? { settings } : {}),
      runtimeEnv: {}
    }
    // 정적 구성 — augmenter 가 없으면 network·vault 접근이 **한 번도 일어나지 않는다**.
    if (!augmenter) return base

    const augmented = await augmenter.resolve(
      { key: entry.key, ...(settings ? { settings } : {}) },
      signal
    )
    return {
      ...base,
      runtimeEnv: augmented.runtimeEnv,
      ...(augmented.validUntil !== undefined ? { validUntil: augmented.validUntil } : {})
    }
  }

  const resolveOnce = async (
    entry: HarnessModelProviderEntry,
    attempt: number
  ): Promise<HarnessRuntimeConfig> => {
    const state = stateFor(entry.key)
    // settings resolve 는 **cache 판정보다 먼저** 온다 — `sourceRevision` 이 cache key 의 일부라
    // 외부 파일 편집(mtime 변화)이 자동으로 miss 가 된다.
    const settings = await deps.settings.resolve(entry)
    const sourceRevision = settings?.sourceRevision ?? ''

    const cached = state.cached
    if (cached && cached.sourceRevision === sourceRevision && usable(cached.config)) {
      return cached.config
    }

    const inFlight = state.inFlight
    // **같은 key·generation·sourceRevision 만** single-flight 를 공유한다.
    if (
      inFlight &&
      inFlight.generation === state.generation &&
      inFlight.sourceRevision === sourceRevision
    ) {
      return inFlight.promise
    }

    const generation = state.generation
    // 공유 작업은 **service-owned signal** 을 쓴다 — caller 의 signal 을 여기 연결하면 한
    // caller 의 취소가 같은 작업을 기다리는 다른 caller 까지 취소한다(0188 D-016).
    const controller = new AbortController()
    const promise = (async (): Promise<HarnessRuntimeConfig> => {
      const config = await compute(entry, settings, controller.signal)
      const current = stateFor(entry.key)
      // ── 완료 fence ────────────────────────────────────────────────────────
      // 시작 이후 무효화가 있었으면 이 결과는 **낡은 세대의 것**이다. cache 에 넣지도,
      // 현재 caller 에게 돌려주지도 않는다.
      if (current.generation !== generation) throw new StaleGenerationSignal()
      current.cached = { config, sourceRevision }
      return config
    })()

    state.inFlight = { generation, sourceRevision, controller, promise }
    try {
      return await promise
    } catch (error) {
      if (!(error instanceof StaleGenerationSignal)) throw error
      // 최신 세대로 제한된 재시도. 소진하면 조용히 옛 값을 주지 않고 명시적으로 실패한다.
      if (attempt >= MAX_STALE_RETRIES) throw new StaleHarnessConfigError(entry.key)
      deps.logger?.('harness.runtime-config.stale-retry', { key: entry.key, attempt })
      return resolveOnce(entry, attempt + 1)
    } finally {
      const current = stateFor(entry.key)
      if (current.inFlight?.promise === promise) delete current.inFlight
    }
  }

  return {
    async resolve(entry, signal) {
      // caller 의 취소는 **자기 대기만** 끝낸다. 공유 작업은 계속 돌아 다른 caller 에게
      // 정상적으로 resolve 된다.
      const work = resolveOnce(entry, 0)
      if (!signal) return work
      if (signal.aborted) throw signal.reason ?? new Error('aborted')
      return Promise.race([work, abortAsRejection(signal)])
    },
    invalidate(key, reason) {
      const targets = key ? [key] : [...states.keys()]
      for (const target of targets) {
        const state = states.get(target)
        if (!state) continue
        state.generation += 1
        delete state.cached
        const inFlight = state.inFlight
        if (inFlight) {
          delete state.inFlight
          // best-effort. abort 성공 여부와 무관하게 완료 fence 가 결과를 막는다.
          inFlight.controller.abort()
        }
        deps.logger?.('harness.runtime-config.invalidated', {
          key: target,
          ...(reason !== undefined ? { reason } : {})
        })
      }
    }
  }
}

// 내부 신호 — 밖으로 새지 않는다(`resolveOnce` 가 잡아 재시도하거나 `StaleHarnessConfigError`
// 로 바꾼다).
class StaleGenerationSignal extends Error {
  constructor() {
    super('stale generation')
    this.name = 'StaleGenerationSignal'
  }
}

function abortAsRejection(signal: AbortSignal): Promise<never> {
  return new Promise((_resolve, reject) => {
    signal.addEventListener('abort', () => reject(signal.reason ?? new Error('aborted')), {
      once: true
    })
  })
}
