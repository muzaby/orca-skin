// 이벤트 루프 멈춤 기록 (0324 AC5·AC6). 판정은 `shared/perf-budget.ts` 가 갖고, 여기는 표본원과
// 로거를 잇는다. 순수 코어(`createStallMonitor`)는 표본원·타이머를 주입받아 vitest 대상이고,
// `startLoopStallMonitor` 만 Node 의 `monitorEventLoopDelay` 를 문다.
//
// 기록은 `info` 다 — warn/error 는 반복 억제(60초 창)가 삼켜 건수를 셀 수 없다.

import { monitorEventLoopDelay } from 'node:perf_hooks'
import {
  STALL_EVENT,
  STALL_SCOPE,
  STALL_WINDOW_MS,
  createStallWindow,
  stallSeverity,
  type StallSource,
  type StallThread
} from '../../../shared/perf-budget'
import { getLogger } from '../log/registry'

// 이 프로세스가 기록에 싣는 스레드 이름. 호스트 진입점이 시작 때 바꾼다.
let currentThread: StallThread = 'main'

export function setStallThread(thread: StallThread): void {
  currentThread = thread
}

export function stallThread(): StallThread {
  return currentThread
}

export interface StallRecord {
  thread: StallThread
  source: StallSource
  durationMs: number
  label?: string
  count?: number
}

// 예산 이상이면 1건 남긴다. 미만이면 아무것도 하지 않는다.
export function recordStall(record: StallRecord): void {
  const severity = stallSeverity(record.durationMs)
  if (severity === null) return
  // 내림 — 반올림하면 기록된 수치와 등급이 어긋난다(159.6ms 는 long 인데 160 으로 보인다).
  const durationMs = Math.floor(record.durationMs)
  getLogger()
    .child(STALL_SCOPE)
    .info(STALL_EVENT, { ...record, durationMs, severity })
}

export interface StallMonitorDeps {
  thread: StallThread
  // 지난 호출 뒤의 지연 표본(ms)들을 돌려주고 비운다.
  drain: () => number[]
  record?: (record: StallRecord) => void
}

// 관측 창 하나를 닫는 함수를 돌려준다 — 창에 표본이 여럿이어도 기록은 최댓값 1건이다.
export function createStallMonitor(deps: StallMonitorDeps): () => void {
  const window = createStallWindow()
  const record = deps.record ?? recordStall
  return () => {
    for (const sample of deps.drain()) window.observe(sample)
    const stall = window.flush()
    if (!stall) return
    record({
      thread: deps.thread,
      source: 'loop',
      durationMs: stall.durationMs,
      count: stall.count
    })
  }
}

const LOOP_RESOLUTION_MS = 10

// 이 프로세스의 이벤트 루프 지연을 창마다 한 번 본다. 반환값은 정지 함수다.
export function startLoopStallMonitor(thread: StallThread = currentThread): () => void {
  const histogram = monitorEventLoopDelay({ resolution: LOOP_RESOLUTION_MS })
  histogram.enable()
  const tick = createStallMonitor({
    thread,
    drain: () => {
      // 히스토그램은 타이머 간격(resolution)을 포함해 잰다 — 그만큼 빼야 지연이다.
      const delayMs = histogram.max / 1e6 - LOOP_RESOLUTION_MS
      histogram.reset()
      return [delayMs]
    }
  })
  const timer = setInterval(tick, STALL_WINDOW_MS)
  timer.unref()
  return () => {
    clearInterval(timer)
    histogram.disable()
  }
}
