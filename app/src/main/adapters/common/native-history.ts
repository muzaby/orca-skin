import type { LoadedMessage } from '../../../shared/ipc'
import type { ResolvedHarnessSettings } from './harness-config'

/** Native storage is authoritative; these reads never submit a model prompt. */
export interface NativeHistoryRequest {
  sessionId: string
  cwd: string
  env?: Record<string, string>
  providerSettings?: ResolvedHarnessSettings
  previous?: { snapshot: NativeHistorySnapshot; cursor?: NativeHistoryCursor }
}

export interface NativeHistoryMessage extends LoadedMessage {
  id: string
  /** An application response can contain several native message records. */
  sourceIds?: string[]
}

export interface NativeHistorySnapshot {
  sessionId: string
  cwd: string
  sourceKey: string
  revision: string
  messages: NativeHistoryMessage[]
  /** Main-process archive only; never included in a renderer DTO. */
  raw?: unknown
}

/** Adapter-owned checkpoint, committed atomically with the archive. */
export interface NativeHistoryCursor {
  version: 1
  sourceKey: string
  revision: string
  checkpoint: Record<string, unknown>
}

export type NativeHistoryResult =
  | { status: 'unchanged' }
  | { status: 'ready'; snapshot: NativeHistorySnapshot; cursor?: NativeHistoryCursor }
  | {
      status: 'missing' | 'unavailable' | 'busy' | 'migration-required'
      message: string
    }
