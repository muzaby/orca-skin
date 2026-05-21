import type { Backend, ChatEvent } from '../../shared/ipc'

export type { Backend, ChatEvent }

export interface SessionAdapter {
  readonly id: Backend
  isInstalled(): Promise<{ installed: boolean; version?: string; binPath?: string }>
  install(): AsyncIterable<{ step: string; log?: string; error?: string; done?: boolean }>
  sendMessage(
    sessionId: string | null,
    text: string,
    cwd: string,
    signal?: AbortSignal,
    // SDK 기본 시스템 프롬프트(claude_code preset) 뒤에 append 할 프로젝트별 지침.
    // 비어 있거나 undefined 면 SDK 기본 동작 그대로.
    systemPromptAppend?: string
  ): AsyncIterable<ChatEvent>
}
