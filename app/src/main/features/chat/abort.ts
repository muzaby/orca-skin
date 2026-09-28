import type { TurnContext } from '../../contracts/turn'
import type { AbortCause } from '../../contracts/session-state'

// 단일 abort 프리미티브 — 진행 턴을 멈춘다: 라이브 핸들에 중단 원인을 표시(markAborted — 0067
// 부터 프로세스 제어는 여기 소유: 장수명 채널은 interrupt 로 턴만 멈추고 채널 생존, 턴-스코프는
// 채널 신호 abort 로 서브프로세스 종료)하고, 턴 AbortController 를 끊어 coordinator 내부(retry
// 대기·승인 보류·settle 판정)를 해소한다. 사용자 중단과 세션 폐기가 공유. live 가
// 아직 없으면(턴 시작 전) markAborted 는 no-op 이고 controller.abort 만 효력.
//
// supervisor 상태에 의존하지 않는 턴 단위 프리미티브다.
export function abortTurn(
  turn: Pick<TurnContext, 'live' | 'controller'>,
  cause: Exclude<AbortCause, null>
): void {
  if (cause !== 'user_cancelled' || !turn.live?.cancelled) turn.live?.markAborted?.(cause)
  turn.controller.abort()
}
