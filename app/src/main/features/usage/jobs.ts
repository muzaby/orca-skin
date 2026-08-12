// 사용량 주기 잡 배선 (0186) — **순수 함수 하나.** electron·croner 를 물지 않으므로 단위
// 테스트가 register/schedule 호출을 그대로 단언할 수 있다.
//
// ── 왜 bootstrap 에 인라인하지 않았나 ────────────────────────────────────────
// `register()` 는 action 을 맵에 넣을 뿐 **타이머를 만들지 않는다** — `schedule()` 이 있어야
// 발화한다. 이 저장소에는 지금까지 `schedule()` 직접 호출이 한 건도 없었고(설정 노출형 2종은
// `applySettings` 가 대신 부른다) 코어 고정형 잡의 선례가 없었다. 그래서 "register 만 하고 끝나는"
// 실수를 테스트로 잠글 자리가 필요했는데, `bootstrap.ts` 는 electron 을 물어 vitest 대상이 아니다.
//
// ── 왜 Scheduler 를 직접 받지 않나 ──────────────────────────────────────────
// `features/usage` 는 `features/scheduler` 를 import 할 수 없다(수직 슬라이스 교차 금지).
// 필요한 두 메서드만 구조적 포트로 받는다 — `Scheduler` 가 구조적으로 이를 만족한다.

import type { UsageFetcher } from './fetcher'

export interface UsageJobScheduler {
  register(key: string, action: () => void | Promise<void>): void
  schedule(key: string, spec: { enabled?: boolean; cron: string }): void
}

// tracker 중 잡이 실제로 쓰는 표면만. 좁게 받아야 테스트가 fake 를 쉽게 만든다.
export interface UsageJobTracker {
  refreshBoundary(): void
  refreshProvider(providerKey: string, signal?: AbortSignal): Promise<unknown>
}

export interface UsageJobOptions {
  // 미주입 = 정상 구성. 원격 잡 자체를 등록하지 않는다.
  fetcher?: UsageFetcher
  // 원격 조회 대상 provider key 목록(발화 시점에 평가한다 — 부팅 후 선언이 바뀔 수 있다).
  providerKeys?: () => readonly string[]
  // 원격 호출 상한. 엔진이 대신 걸어주지 않는다(가이드 §5-b).
  fetchTimeoutMs?: number
}

// 자정 = 일 경계이자 주·월 경계의 상위집합이라, 잡 하나로 세 기간 갱신을 덮는다.
export const USAGE_BOUNDARY_CRON = '0 0 * * *'
// 명세가 제시한 1분 주기. 겹침은 Scheduler 가 `skipped` 로 막는다.
export const USAGE_FETCH_CRON = '* * * * *'
const DEFAULT_FETCH_TIMEOUT_MS = 5_000

export function registerUsageJobs(
  scheduler: UsageJobScheduler,
  tracker: UsageJobTracker,
  options: UsageJobOptions = {}
): void {
  // 기간 경계 갱신 — **코어 고정형**이라 설정에 노출하지 않는다. Main 이 값을 굳혀 push 하는
  // 구조라 이 잡이 없으면 자정을 넘긴 화면이 어제 기준에 멈추고, 되살릴 장치가 없다.
  //
  // **`recordAndBroadcast()` 가 아니라 `refreshBoundary()` 다.** 전자는 전역만 내보내
  // renderer 가 캐시한 provider 뷰가 어제 기준으로 남는다 — 경계에서는 그 캐시까지 무효화해야 한다.
  //
  // 설정 노출형 `usage-recompute`(기본 off)와의 관계: 경계 불변식은 **이 잡이 소유**하고,
  // 그쪽은 사용자가 임의 주기로 켜는 **호환용**이다. 둘 다 켜져 시각이 겹쳐도 각자 전역을
  // 재계산할 뿐이라 데이터가 어긋나지 않는다(중복 계산일 뿐). 정리는 후속.
  scheduler.register('usage-boundary', () => tracker.refreshBoundary())
  scheduler.schedule('usage-boundary', { enabled: true, cron: USAGE_BOUNDARY_CRON })

  // 원격 갱신 — fetcher 가 없으면 **등록조차 하지 않는다.** 부를 대상 없는 잡은 죽은 배관이고,
  // `schedule_runs` 에 의미 없는 성공 기록만 쌓인다.
  if (!options.fetcher) return

  const timeoutMs = options.fetchTimeoutMs ?? DEFAULT_FETCH_TIMEOUT_MS
  scheduler.register('usage-fetch', async () => {
    for (const providerKey of options.providerKeys?.() ?? []) {
      if (!options.fetcher?.supports(providerKey)) continue
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), timeoutMs)
      try {
        await tracker.refreshProvider(providerKey, controller.signal)
      } catch {
        // 원격 장애는 provider 별 fail-soft 다. 다음 provider 와 다음 cron tick 을 계속 실행한다.
      } finally {
        clearTimeout(timer)
      }
    }
  })
  scheduler.schedule('usage-fetch', { enabled: true, cron: USAGE_FETCH_CRON })
}
