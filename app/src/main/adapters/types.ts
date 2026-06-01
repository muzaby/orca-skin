import type { Backend, ChatEvent } from '../../shared/ipc'
import type { TurnRequest } from '../capabilities/types'

export type { Backend, ChatEvent }

export interface SessionAdapter {
  readonly id: Backend
  isInstalled(): Promise<{ installed: boolean; version?: string; binPath?: string }>
  install(): AsyncIterable<{ step: string; log?: string; error?: string; done?: boolean }>
  // 한 턴 실행. 보조기능(mcp·skills·hooks·systemPrompt)은 req.capabilities 로, uv 런타임 env 는
  // req.env 로 전달된다 — 위치 인자 증식(구 7개) 대신 단일 TurnRequest 로 통합 (설계검토 §9).
  sendMessage(req: TurnRequest): AsyncIterable<ChatEvent>
}
