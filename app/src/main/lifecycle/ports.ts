import type { Backend, ClassifiedError, NormalizedEvent } from '../../shared/ipc'
import type { ClaudePermissionMode } from '../../shared/permission-mode'
import type { TurnRequest } from '../adapters/turn'
import type { SessionRuntimeState } from './session-state'

// L1 lifecycle 포트. lifecycle 은 L2 adapters 를 import 하지 않고, 구조적으로 호환되는
// turn-local live/title adapter surface 만 기록한다.
export interface RuntimeLiveTurn {
  events: AsyncIterable<NormalizedEvent>
  close(): void
  setPermissionMode(mode: ClaudePermissionMode): Promise<void>
  interrupt(): Promise<void>
  // steer UX 수용 여부 — 전달은 어댑터 게이트 훅(TurnRequest.takeSteerFlush) 또는 다음 턴
  // carryover(0060 D2/D3). mid-turn stdin 직주입 경로(injectMessage)는 0060 D3 에서 제거됐다.
  readonly canSteer?: boolean
  setModel(model?: string): Promise<void>
  stopTask(taskId: string): Promise<void>
  backgroundTask(toolUseId: string): Promise<boolean>
  markAborted?(cause: 'user_cancelled' | 'stall' | 'retry'): void
  readonly cancelled?: boolean
  readonly timedOut?: boolean
}

export interface RuntimeCompleteRequest {
  prompt: string
  model?: string
  cwd?: string
  signal?: AbortSignal
  providerSettings?: import('../features/providers/provider-settings').ResolvedProviderSettings
  env?: Record<string, string>
}

export interface RuntimeTitleAdapter {
  readonly id: Backend
  complete(req: RuntimeCompleteRequest): Promise<string>
}

export interface RuntimeSessionAdapter extends RuntimeTitleAdapter {
  sendMessage(req: TurnRequest): RuntimeLiveTurn
  classifyError(error: unknown, phase: string): ClassifiedError
}

// Supervisor/RuntimePool 이 관리하는 SessionRuntime 표면 — 실행 핸들(RuntimeLiveTurn) 위에
// 라이프사이클 거버넌스에 필요한 최소만 더한다: 현재 상태(보존 가능 판정용)와 close 정책(reusable).
// SessionRuntime(session-runtime.ts)이 구조적으로 만족한다(0054).
export interface ManagedRuntime extends RuntimeLiveTurn {
  readonly state: SessionRuntimeState
  readonly reusable: boolean
  close(): void
}
