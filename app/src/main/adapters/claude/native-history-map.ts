import type { SDKMessage, SessionMessage, SessionStoreEntry } from '@anthropic-ai/claude-agent-sdk'
import type { AppMessagePart, NormalizedEvent } from '../../../shared/ipc'
import { isRecord } from '../../../shared/obj'
import type { NativeHistoryMessage } from '../common/native-history'
import { claudeToNormalized, type MapContext } from './map'
import { nativeCommandText } from './native-command-text'

export type ClaudeHistoryEntry = Record<string, unknown>

/** The SDK owns branch/compaction selection. Its display filter must not erase automatic inputs. */
export async function selectClaudeHistory(
  sessionId: string,
  cwd: string,
  entries: ClaudeHistoryEntry[]
): Promise<ClaudeHistoryEntry[]> {
  const { getSessionMessages } = await import('@anthropic-ai/claude-agent-sdk')
  const byId = new Map<string, ClaudeHistoryEntry>()
  for (const entry of entries) {
    if (typeof entry.uuid === 'string') byId.set(entry.uuid, entry)
    const attachment = isRecord(entry.attachment) ? entry.attachment : undefined
    if (typeof attachment?.source_uuid === 'string') byId.set(attachment.source_uuid, entry)
  }
  const selected = await getSessionMessages(sessionId, {
    dir: cwd,
    includeSystemMessages: true,
    sessionStore: {
      load: async () =>
        entries.map((entry) => ({
          ...entry,
          type: typeof entry.type === 'string' ? entry.type : 'unknown',
          isMeta: false,
          ...(isRecord(entry.attachment)
            ? { attachment: { ...entry.attachment, isMeta: false } }
            : {})
        })) as SessionStoreEntry[],
      append: async () => {
        throw new Error('Native history snapshots are read-only')
      }
    }
  })
  return selected.map((message: SessionMessage) => {
    const raw = byId.get(message.uuid) ?? {}
    const attachment = isRecord(raw.attachment) ? raw.attachment : undefined
    const origin = raw.origin ?? attachment?.origin
    // Queued commands are converted by the SDK only once delivered. Keep that conversion,
    // while restoring metadata (including origin) which its public projection omits.
    return {
      ...raw,
      ...message,
      ...(origin !== undefined ? { origin } : {}),
      ...(raw.isMeta === true || attachment?.isMeta === true ? { isMeta: true } : {})
    }
  })
}

/** A closed response snapshot is not an OS-wide process lock. */
export function isClaudeHistoryComplete(entries: ClaudeHistoryEntry[], raw = entries): boolean {
  const pending = new Set<string>()
  let last: ClaudeHistoryEntry | undefined
  for (const entry of entries) {
    if (entry.type !== 'assistant' && entry.type !== 'user') continue
    last = entry
    const message = isRecord(entry.message) ? entry.message : undefined
    const content = Array.isArray(message?.content) ? message.content : []
    for (const part of content) {
      if (!isRecord(part)) continue
      if (part.type === 'tool_use' && typeof part.id === 'string') pending.add(part.id)
      if (part.type === 'tool_result' && typeof part.tool_use_id === 'string')
        pending.delete(part.tool_use_id)
    }
  }
  if (last?.type !== 'assistant' || last.isApiErrorMessage === true || pending.size > 0)
    return false
  const message = isRecord(last.message) ? last.message : undefined
  if (message?.stop_reason !== 'end_turn' && message?.stop_reason !== 'stop_sequence') return false
  const ids = new Set(entries.map((entry) => entry.uuid))
  const frontier = raw.findLastIndex((entry) => ids.has(entry.uuid))
  // A persisted state envelope can follow the conversation chain's last assistant.
  const state = raw
    .slice(frontier + 1)
    .findLast((entry) => entry.type === 'system' && entry.subtype === 'session_state_changed')
  return state?.state !== 'running' && state?.state !== 'requires_action'
}

function timestamp(entry: ClaudeHistoryEntry): number {
  const value = typeof entry.timestamp === 'string' ? Date.parse(entry.timestamp) : NaN
  return Number.isFinite(value) ? value : 0
}

function historicalPart(event: NormalizedEvent): AppMessagePart | undefined {
  switch (event.type) {
    case 'message.completed':
      return {
        type: 'text',
        text: event.message.text,
        ...(event.parentToolRunId ? { parentToolRunId: event.parentToolRunId } : {})
      }
    case 'message.reasoning':
      return {
        type: 'reasoning',
        text: event.text,
        ...(event.signature ? { signature: event.signature } : {}),
        ...(event.parentToolRunId ? { parentToolRunId: event.parentToolRunId } : {})
      }
    case 'tool.call.started':
      return {
        type: 'tool_call',
        toolRunId: event.toolRunId,
        toolName: event.toolName,
        args: event.args,
        ...(event.parentToolRunId ? { parentToolRunId: event.parentToolRunId } : {})
      }
    case 'tool.call.completed':
      return {
        type: 'tool_result',
        toolRunId: event.toolRunId,
        result: event.result ?? null,
        isError: event.isError,
        ...(event.parentToolRunId ? { parentToolRunId: event.parentToolRunId } : {}),
        ...(event.subagentMeta ? { subagentMeta: event.subagentMeta } : {}),
        ...(event.structuredOutput !== undefined
          ? { structuredOutput: event.structuredOutput }
          : {}),
        ...(event.nonExecution ? { nonExecution: event.nonExecution } : {})
      }
    case 'session.compacted':
      return {
        type: 'compact_boundary',
        ...(event.trigger ? { trigger: event.trigger } : {}),
        ...(event.preTokens !== undefined ? { preTokens: event.preTokens } : {}),
        ...(event.postTokens !== undefined ? { postTokens: event.postTokens } : {})
      }
    default:
      return undefined
  }
}

/** Build display parts only: no approval, automatic prompt, telemetry or background replay. */
export function mapClaudeHistory(
  entries: ClaudeHistoryEntry[],
  sessionId: string,
  cwd: string
): NativeHistoryMessage[] {
  const context: MapContext = { sessionId, cwd }
  const messages: NativeHistoryMessage[] = []
  let assistant: NativeHistoryMessage | undefined
  for (const entry of entries) {
    if (typeof entry.uuid !== 'string') continue
    const native = {
      ...entry,
      session_id: sessionId,
      // Native JSONL uses camelCase; SDK stream envelopes use snake_case.
      tool_use_result: entry.tool_use_result ?? entry.toolUseResult,
      tool_result_meta: entry.tool_result_meta ?? entry.toolResultMeta,
      compact_metadata:
        entry.compact_metadata ??
        (isRecord(entry.compactMetadata)
          ? {
              trigger: entry.compactMetadata.trigger,
              pre_tokens: entry.compactMetadata.preTokens,
              post_tokens: entry.compactMetadata.postTokens
            }
          : undefined),
      // Meta provenance is authoritative. A human who types XML remains a human.
      ...(entry.isMeta === true && entry.origin === undefined ? { isSynthetic: true } : {})
    }
    const events = claudeToNormalized(native as unknown as SDKMessage, context)
    const content =
      isRecord(entry.message) && Array.isArray(entry.message.content) ? entry.message.content : []
    // Image-only composer turns have no text echo, but their UUID still owns Orca's
    // attachment sidecar. Do not lose that identity when projecting native history.
    if (
      entry.type === 'user' &&
      entry.parent_tool_use_id == null &&
      content.some((part) => isRecord(part) && part.type === 'image') &&
      !content.some((part) => isRecord(part) && part.type === 'tool_result') &&
      !events.some((event) => event.type === 'input.echo' || event.type === 'input.received')
    ) {
      assistant = undefined
      messages.push({
        id: entry.uuid,
        sourceIds: [entry.uuid],
        role: 'user',
        createdAt: timestamp(entry),
        parts: []
      })
    }
    for (const event of events) {
      if (event.type === 'input.echo' || event.type === 'input.received') {
        assistant = undefined
        messages.push({
          id: entry.uuid,
          sourceIds: [entry.uuid],
          role: 'user',
          createdAt: timestamp(entry),
          parts: [
            {
              type: 'text',
              text: event.type === 'input.echo' ? nativeCommandText(event.text) : event.text,
              ...(event.type === 'input.received' ? { origin: event.origin } : {})
            }
          ]
        })
        continue
      }
      const part = historicalPart(event)
      if (!part) continue
      if (!assistant) {
        assistant = {
          id: entry.uuid,
          sourceIds: [],
          role: 'assistant',
          createdAt: timestamp(entry),
          parts: []
        }
        messages.push(assistant)
      }
      if (!assistant.sourceIds!.includes(entry.uuid)) assistant.sourceIds!.push(entry.uuid)
      assistant.parts.push(part)
    }
  }
  return messages
}
