import type { Backend, ClassifiedError, NormalizedEvent } from '../../shared/ipc'
import type { ClaudePermissionMode } from '../../shared/permission-mode'
import type { TurnRequest } from '../extensions/types'

// L1 lifecycle 포트. lifecycle 은 L2 adapters 를 import 하지 않고, 구조적으로 호환되는
// turn-local live/title adapter surface 만 기록한다.
export interface RuntimeLiveTurn {
  events: AsyncIterable<NormalizedEvent>
  close(): void
  setPermissionMode(mode: ClaudePermissionMode): Promise<void>
  interrupt(): Promise<void>
  setModel(model?: string): Promise<void>
  stopTask(taskId: string): Promise<void>
  backgroundTask(toolUseId: string): Promise<boolean>
}

export interface RuntimeCompleteRequest {
  prompt: string
  model?: string
  cwd?: string
  signal?: AbortSignal
  providerSettings?: import('../settings/provider-settings').ResolvedProviderSettings
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
