import type { LiveTurn, SessionAdapter, CompleteRequest } from '../adapters/types'
import type { SessionRuntimeState } from './session-state'

// 런타임 거버넌스 계약. adapters 의 ports&adapters 정본(`LiveTurn`·`SessionAdapter`·`CompleteRequest`)을
// 재선언하지 않고 그 위에 얇게 얹는다(handoff 0063 — 구조적 중복 제거). 어댑터가 정의하는 것과
// 동일한 것은 alias 로, 런타임 거버넌스가 *더하는* 것만 새 필드로 선언한다.

// 거버넌스가 얹힌 live 핸들 표면 — `TurnContext.live` 가 담는 값(`SessionRuntime`)의 타입.
// 어댑터 raw 핸들(`LiveTurn`) 위에 abort 표시 훅(markAborted)과 원인 플래그(cancelled/timedOut)를
// 더한다. 이 3종은 SessionRuntime 이 소유(어댑터 raw 핸들엔 없음)하므로 optional 로 둔다 —
// raw `LiveTurn` 도 이 타입에 대입 가능(선택 필드 부재 허용).
export interface RuntimeLiveTurn extends LiveTurn {
  markAborted?(cause: 'user_cancelled' | 'stall' | 'retry'): void
  readonly cancelled?: boolean
  readonly timedOut?: boolean
}

// 어댑터 계약의 부분집합 — 런타임(턴 실행)이 실제로 쓰는 표면만 골라 재사용한다(단일 정본은
// adapters/types). 설치 수명주기(describe·isInstalled·install)는 registry/app 소관이라 제외한다
// (Interface Segregation — SessionRuntime 은 턴 실행 표면만 의존).
export type RuntimeCompleteRequest = CompleteRequest
export type RuntimeTitleAdapter = Pick<SessionAdapter, 'id' | 'complete'>
export type RuntimeSessionAdapter = Pick<
  SessionAdapter,
  'id' | 'complete' | 'sendMessage' | 'classifyError'
>

// Supervisor/RuntimePool 이 관리하는 SessionRuntime 표면 — 거버넌스 live 핸들 위에 보존 판정에
// 필요한 최소(현재 상태 + reusable close 정책)를 더한다. SessionRuntime 이 구조적으로 만족한다(0054).
export interface ManagedRuntime extends RuntimeLiveTurn {
  readonly state: SessionRuntimeState
  readonly reusable: boolean
  close(): void
}
