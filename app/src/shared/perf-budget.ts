// UI 스레드 반응성 예산의 정본 (0324 D-007). main·에이전트 호스트·renderer 의 멈춤 판정이
// 모두 이 상수를 본다 — 수치의 근거는 docs/decisions/012-execution-contexts.md.

// 한 작업이 이 시간 이상 스레드를 잡으면 멈춤(`perf.stall`)으로 기록한다 (W3C Long Tasks).
export const UI_TASK_BUDGET_MS = 50
// 이 시간 이상은 심각으로 기록한다.
export const STALL_SEVERE_MS = 160
// UI 스레드(renderer 메인 · 셸)에서 시간 조각으로 나눠 여러 태스크에 걸쳐 도는 작업이 조각마다 양보하는
// 간격(0324 D-057). 한 번에 끝나는 작업은 위 두 기준이 맡는다. 지금 그런 작업은 React 지연 렌더뿐이고
// React 스케줄러가 같은 간격으로 양보해 참조가 없다 — 직접 나눠 도는 코드를 만들 때 쓴다. 가드는 보지 않는다.
export const UI_YIELD_INTERVAL_MS = 5
// 멈춤 기록의 관측 창 — 창 하나에 기록 1건(최댓값)만 남긴다.
export const STALL_WINDOW_MS = 1000

export type StallSeverity = 'long' | 'severe'
export type StallThread = 'main' | 'agent-host' | 'data-host' | 'renderer'
// `peer` — 호스트 사이 피어 포트로 받은 메시지의 처리(0324 D-043).
export type StallSource = 'loop' | 'ipc' | 'peer' | 'longtask'

export const STALL_EVENT = 'perf.stall'
export const STALL_SCOPE = 'perf'

export function stallSeverity(durationMs: number): StallSeverity | null {
  if (durationMs >= STALL_SEVERE_MS) return 'severe'
  if (durationMs >= UI_TASK_BUDGET_MS) return 'long'
  return null
}

// 한 관측 창의 표본을 최댓값 하나로 접는다. 예산 미만 표본은 세지 않는다.
export interface StallWindow {
  observe(durationMs: number): void
  // 창을 닫는다 — 예산 이상 표본이 있었으면 최댓값·개수를 돌려주고 비운다.
  flush(): { durationMs: number; severity: StallSeverity; count: number } | null
}

export function createStallWindow(): StallWindow {
  let max = 0
  let count = 0
  return {
    observe(durationMs) {
      if (stallSeverity(durationMs) === null) return
      count += 1
      if (durationMs > max) max = durationMs
    },
    flush() {
      const severity = stallSeverity(max)
      if (severity === null) return null
      const out = { durationMs: max, severity, count }
      max = 0
      count = 0
      return out
    }
  }
}
