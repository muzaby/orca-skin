// 예약 프롬프트 릴레이. main 의 예약 발화가 "새 대화를 시작해 달라" 고 보내면, 평소의
// 새 대화 경로(`chat:send`)로 전송하고 세션 id(또는 실패 사유)를 돌려준다. 보고 있는 대화는
// 바뀌지 않는다.

import { useEffect } from 'react'
import type {
  PromptExecution,
  ScheduledPromptReport,
  ScheduledPromptStart
} from '../../../../shared/scheduled-tasks'
import { chatActions } from '../../features/chat'
import { scheduleApi } from '../../shared/api/ipc'
import { rendererLog } from '../../shared/logging'

export interface ScheduledPromptRelayDeps {
  start: (input: {
    projectId: string
    text: string
    execution: PromptExecution
  }) => Promise<{ sessionId: string }>
  report: (report: ScheduledPromptReport) => Promise<void>
}

// 성공·실패 어느 쪽이든 반드시 한 번 보고한다 — 보고가 없으면 main 의 실행 이력이 시간 초과까지
// `실행 중` 으로 남는다.
export async function relayScheduledPrompt(
  payload: ScheduledPromptStart,
  deps: ScheduledPromptRelayDeps
): Promise<void> {
  let report: ScheduledPromptReport
  try {
    const { sessionId } = await deps.start({
      projectId: payload.projectId,
      text: payload.text,
      execution: payload.execution
    })
    report = { runId: payload.runId, ok: true, sessionId }
  } catch (e) {
    report = {
      runId: payload.runId,
      ok: false,
      error: (e instanceof Error ? e.message : String(e)).slice(0, 2000)
    }
  }
  await deps.report(report)
}

export function useScheduledPromptRelay(): void {
  useEffect(
    () =>
      scheduleApi.onPromptStart((payload) => {
        void relayScheduledPrompt(payload, {
          start: chatActions.startDetachedChat,
          report: scheduleApi.reportPrompt
        }).catch((error) =>
          // 보고 IPC 자체가 실패했다 — main 은 시간 초과로 그 실행을 실패 종결한다.
          rendererLog.warn('schedules.prompt-report.failed', 'schedules', { error: String(error) })
        )
      }),
    []
  )
}
