// 반복 억제 (0123 AC11) — 동일 fingerprint(event + error.name + error.code) 의 warn/error 가
// 단기간 반복되면 개별 기록 대신 집계 1건으로 낮춰 파일 폭증을 막는다.
// info/debug 는 대상이 아니다(카탈로그가 화이트리스트라 폭증 소지 낮음 — 0124).
// electron 비의존 순수 클래스 → vitest 대상.

import type { LogRecord } from '../../../shared/logging'

interface SuppressDecision {
  // 'emit' = 그대로 기록 · 'drop' = 폐기(집계 카운트만 증가) ·
  // 'summary' = 직전 창의 집계 레코드를 함께 기록 (suppressedCount 첨부)
  action: 'emit' | 'drop' | 'summary'
  suppressedCount?: number
  windowMs?: number
}

interface WindowState {
  windowStart: number
  suppressed: number
}

export function fingerprintOf(record: LogRecord): string {
  return `${record.event}|${record.error?.name ?? ''}|${record.error?.code ?? ''}`
}

export class RepeatSuppressor {
  private readonly windows = new Map<string, WindowState>()

  constructor(
    private readonly windowMs = 60_000,
    private readonly now: () => number = Date.now
  ) {}

  check(record: LogRecord): SuppressDecision {
    if (record.level !== 'warn' && record.level !== 'error') return { action: 'emit' }
    const fp = fingerprintOf(record)
    const at = this.now()
    const state = this.windows.get(fp)
    if (!state) {
      this.windows.set(fp, { windowStart: at, suppressed: 0 })
      return { action: 'emit' }
    }
    if (at - state.windowStart < this.windowMs) {
      state.suppressed += 1
      return { action: 'drop' }
    }
    // 창 만료 — 새 창을 열고, 직전 창에서 삼킨 것이 있으면 집계를 반환한다.
    const suppressed = state.suppressed
    state.windowStart = at
    state.suppressed = 0
    if (suppressed > 0) {
      return { action: 'summary', suppressedCount: suppressed, windowMs: this.windowMs }
    }
    return { action: 'emit' }
  }
}
