import type { DbQueries } from '../../infra/db'
import type { DanglingToolCallRow } from '../../infra/db/types'

export const ABORTED_TOOL_RESULT_PAYLOAD = JSON.stringify({
  result: { reason: 'aborted', message: '중단되었습니다' },
  isError: true
})

export interface RecoverDanglingToolCallsOptions {
  sessionId?: string
  isSessionLive?: (sessionId: string) => boolean
}

export interface RecoverySummary {
  messagesCompleted: number
  toolResultsWritten: number
}

export function recoverDanglingToolCalls(
  db: Pick<
    DbQueries,
    'findDanglingToolCalls' | 'upsertToolResultPartScoped' | 'markMessageComplete'
  >,
  options: RecoverDanglingToolCallsOptions = {}
): RecoverySummary {
  const rows = db.findDanglingToolCalls(options.sessionId)
  const completed = new Set<number>()
  let toolResultsWritten = 0

  for (const row of rows) {
    if (options.isSessionLive?.(row.session_id)) continue
    db.upsertToolResultPartScoped(row.message_id, row.tool_run_id, ABORTED_TOOL_RESULT_PAYLOAD)
    toolResultsWritten += 1
    completed.add(row.message_id)
  }

  for (const messageId of completed) db.markMessageComplete(messageId)
  return { messagesCompleted: completed.size, toolResultsWritten }
}

export function groupDanglingToolCallsByMessage(
  rows: readonly DanglingToolCallRow[]
): Map<number, DanglingToolCallRow[]> {
  const grouped = new Map<number, DanglingToolCallRow[]>()
  for (const row of rows) {
    const current = grouped.get(row.message_id) ?? []
    current.push(row)
    grouped.set(row.message_id, current)
  }
  return grouped
}
