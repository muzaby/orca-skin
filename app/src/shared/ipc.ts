// IPC 채널 이름 + 순수 TS 타입. zod 의존 없음 — preload (sandbox=true) 와 renderer 모두 안전하게 import.
// main 프로세스의 런타임 검증 (zod 스키마) 은 ./protocol.ts 에 별도로 둔다.

// Phase 2 활성 채널 (preload 노출 대상). 미사용 채널은 의도적으로 누락.
export const CHANNELS = {
  chatSend: 'orca:chat:send',
  chatEvent: 'orca:chat:event',
  chatCancel: 'orca:chat:cancel',
  backendList: 'orca:backend:list',
  installStart: 'orca:install:start',
  installStatus: 'orca:install:status'
} as const

// Backend (Phase 2: claude-code 단일. opencode 는 future work)
export type Backend = 'claude-code'

// Error 코드 (TRD §6.6)
export type ErrorCode =
  | 'cli.not-installed'
  | 'cli.spawn-failed'
  | 'cli.crashed'
  | 'cli.timeout'
  | 'auth.expired'
  | 'protocol.parse'
  | 'internal'

// ChatEvent (TRD §6.2) — 어댑터→Renderer 정규화 스트림
export type ChatEvent =
  | { type: 'init'; data: { sessionId: string; model?: string; cwd: string } }
  | { type: 'assistant_delta'; data: { text: string } }
  | { type: 'assistant_message'; data: { text: string } }
  | { type: 'tool_use'; data: { toolUseId: string; name: string; input: unknown } }
  | {
      type: 'tool_result'
      data: { toolUseId: string; output: unknown; isError: boolean; durationMs?: number }
    }
  | { type: 'result'; data: { usage?: { inputTokens: number; outputTokens: number } } }
  | { type: 'error'; data: { code: ErrorCode; message: string; recoverable: boolean } }

// IPC payloads (TRD §5.2 의 활성 부분)
export interface SendChatMessage {
  sessionId: string | null
  text: string
}

export interface CancelChat {
  sessionId: string
}

export interface BackendListResult {
  backends: { id: Backend; installed: boolean; version?: string }[]
  active?: Backend
}

export interface StartInstall {
  backend: Backend
}

export interface InstallStatus {
  step: string
  progress?: number
  log?: string
  error?: string
  done?: boolean
}
