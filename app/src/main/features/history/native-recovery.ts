import type { LoadedMessage } from '../../../shared/ipc'
import type { NativeHistoryResult } from '../../adapters/common/native-history'
import type { NativeRecoveryRow } from '../../infra/db/native-history-queries'

/** Native storage still owns current history. The prefix is a sealed, expired generation. */
export function recoveryArchive(row?: NativeRecoveryRow): LoadedMessage[] {
  return row ? (JSON.parse(row.archive_json) as LoadedMessage[]) : []
}

export function restoreRecoveryResult(
  result: NativeHistoryResult,
  sessionId: string,
  recovery?: NativeRecoveryRow
): NativeHistoryResult {
  if (result.status !== 'ready') return result
  return {
    ...result,
    snapshot: {
      ...result.snapshot,
      sessionId,
      messages: result.snapshot.messages.map((message) =>
        recovery?.prompt_id &&
        (message.id === recovery.prompt_id || message.sourceIds?.includes(recovery.prompt_id)) &&
        message.role === 'user'
          ? {
              ...message,
              parts: [
                { type: 'text', text: recovery.prompt_text ?? '' },
                ...message.parts.filter((part) => part.type !== 'text')
              ]
            }
          : message
      )
    }
  }
}

export function archivePrompt(messages: LoadedMessage[]): string {
  // JSON quoting preserves roles/tool results as data instead of turning their text into instructions.
  return JSON.stringify(messages.map(({ role, parts }) => ({ role, parts })))
}
