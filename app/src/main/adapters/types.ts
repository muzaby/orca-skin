import type { Backend, NormalizedEvent } from '../../shared/ipc'
import type { TurnRequest } from '../extensions/types'

export type { Backend, NormalizedEvent }

export interface SessionAdapter {
  readonly id: Backend
  isInstalled(): Promise<{ installed: boolean; version?: string; binPath?: string }>
  install(): AsyncIterable<{ step: string; log?: string; error?: string; done?: boolean }>
  // 한 턴 실행. 확장 리소스(mcp·skills·hooks·systemPrompt)는 req.extensions 로, uv 런타임 env 는
  // req.env 로 전달된다 — 위치 인자 증식(구 7개) 대신 단일 TurnRequest 로 통합 (설계검토 §9).
  // provider 중립 NormalizedEvent 스트림(provider-runtime.md §2)을 yield 한다.
  sendMessage(req: TurnRequest): AsyncIterable<NormalizedEvent>
}
