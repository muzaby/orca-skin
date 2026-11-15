// 예약 프롬프트의 새 대화 시작을 renderer 에 맡기고 결과 보고를 기다린다.
//
// main 이 직접 턴을 시작하지 않는 이유: `chat:send` 는 요청한 창(WebContents)을 lease 소유자·
// 이벤트 수신자로 쓰고, renderer 는 세션 id 가 없는 이벤트를 자기 pending 키로 라우팅한다.
// 그 경로를 그대로 지나게 하려고 renderer 가 평소처럼 전송하게 한다.

import {
  SCHEDULE_RUN_ERROR,
  type ScheduledPromptReport,
  type ScheduledPromptStart
} from '../../../shared/scheduled-tasks'
import { PROMPT_REPORT_TIMEOUT_MS } from './limits'

interface Pending {
  resolve: (value: { sessionId: string }) => void
  reject: (reason: Error) => void
  timer: ReturnType<typeof setTimeout>
  detach: () => void
}

export class PromptRelay {
  private readonly pending = new Map<number, Pending>()

  constructor(
    // 보낼 창이 없으면 false.
    private readonly send: (payload: ScheduledPromptStart) => boolean,
    private readonly timeoutMs: number = PROMPT_REPORT_TIMEOUT_MS
  ) {}

  request(payload: ScheduledPromptStart, signal: AbortSignal): Promise<{ sessionId: string }> {
    return new Promise((resolve, reject) => {
      if (signal.aborted) return reject(new Error(SCHEDULE_RUN_ERROR.cancelled))
      if (!this.send(payload)) return reject(new Error(SCHEDULE_RUN_ERROR.noWindow))
      const onAbort = (): void =>
        this.settle(payload.runId, new Error(SCHEDULE_RUN_ERROR.cancelled))
      signal.addEventListener('abort', onAbort, { once: true })
      this.pending.set(payload.runId, {
        resolve,
        reject,
        timer: setTimeout(
          () => this.settle(payload.runId, new Error(SCHEDULE_RUN_ERROR.reportTimeout)),
          this.timeoutMs
        ),
        detach: () => signal.removeEventListener('abort', onAbort)
      })
    })
  }

  // 대기 중이 아닌 runId 의 보고는 무시한다(시간 초과 뒤 늦은 보고·중복 보고).
  report(report: ScheduledPromptReport): void {
    this.settle(
      report.runId,
      report.ok ? { sessionId: report.sessionId } : new Error(report.error || 'unknown')
    )
  }

  dispose(): void {
    for (const runId of [...this.pending.keys()]) {
      this.settle(runId, new Error(SCHEDULE_RUN_ERROR.appQuit))
    }
  }

  private settle(runId: number, outcome: { sessionId: string } | Error): void {
    const entry = this.pending.get(runId)
    if (!entry) return
    this.pending.delete(runId)
    clearTimeout(entry.timer)
    entry.detach()
    if (outcome instanceof Error) entry.reject(outcome)
    else entry.resolve(outcome)
  }
}
