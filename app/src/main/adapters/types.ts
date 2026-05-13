import type { Backend, ChatEvent } from '../../shared/ipc'

export type { Backend, ChatEvent }

export interface SessionAdapter {
  readonly id: Backend
  isInstalled(): Promise<{ installed: boolean; version?: string }>
  install(): AsyncIterable<{ step: string; log?: string; error?: string; done?: boolean }>
  sendMessage(
    sessionId: string | null,
    text: string,
    cwd: string,
    signal?: AbortSignal
  ): AsyncIterable<ChatEvent>
}
