import type { NormalizedEvent } from '../../../shared/ipc'
import type { ResponseBoundary } from '../../../shared/response-boundary'

// 표시 가능한 이벤트만 구간을 연다. tick/usage와 무출력 listen은 행을 만들지 않는다.
export function isResponseDisplayEvent(event: NormalizedEvent): boolean {
  // 자식 출력은 오른쪽 상세가 소유한다. 자식만 수신한 listen에 빈 본문 구간을 만들지 않는다.
  if ('parentToolRunId' in event && event.parentToolRunId !== undefined) return false
  switch (event.type) {
    case 'message.delta':
    case 'message.reasoning.delta':
    case 'message.reasoning':
    case 'message.completed':
    case 'tool.call.started':
    case 'tool.call.completed':
    case 'error':
    case 'session.compacted':
      return true
    case 'subagent.task':
      return event.phase === 'settled' && event.background === true
    default:
      return false
  }
}

export function responseBoundaryOutcome(input: {
  aborted: boolean
  failed: boolean
  terminal: boolean
}): Extract<ResponseBoundary, { phase: 'end' }>['outcome'] {
  if (input.aborted) return 'aborted'
  if (input.failed) return 'failed'
  return input.terminal ? 'ended' : 'unknown'
}
