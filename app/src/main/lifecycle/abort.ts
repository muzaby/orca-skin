import type { TurnContext } from './turn-context'
import type { AbortCause } from './session-state'

// 단일 abort 프리미티브 — 진행 턴을 멈춘다: 라이브 핸들에 중단 원인을 표시(markAborted)하고
// AbortController 를 끊어 SDK 스트림/서브프로세스를 종료시킨다(0053). chatCancel 핸들러
// (ipc/chat/send.ts)와 stall 타임아웃(lifecycle/timers.ts)이 동일 코드로 공유한다. live 가 아직
// 없으면(턴 시작 전) markAborted 는 no-op 이고 controller.abort 만 효력.
//
// supervisor 가 아니라 별도 모듈에 둔다(turn-level 프리미티브 — supervisor 상태 불필요). timers 가
// 이를 import 하고 supervisor 가 RuntimePool→timers 를 경유하므로, abortTurn 을 supervisor 에 두면
// supervisor→runtime-pool→timers→supervisor 순환이 생긴다(import/no-cycle). 분리로 차단(0054).
export function abortTurn(
  turn: Pick<TurnContext, 'live' | 'controller'>,
  cause: Exclude<AbortCause, null>
): void {
  turn.live?.markAborted?.(cause)
  turn.controller.abort()
}
