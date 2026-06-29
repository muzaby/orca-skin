import type { DbQueries } from '../db'

export const RECOVERED_TOOL_RESULT_PAYLOAD = JSON.stringify({
  reason: 'aborted',
  message: '중단되었습니다'
})

export interface DanglingRecoveryReport {
  recoveredTools: number
  completedMessages: number
}

export function recoverDanglingToolCalls(
  db: Pick<DbQueries, 'findDanglingToolCalls' | 'upsertToolResultPart' | 'markMessageComplete'>
): DanglingRecoveryReport {
  const rows = db.findDanglingToolCalls()
  const messageIds = new Set<number>()
  for (const row of rows) {
    db.upsertToolResultPart(row.message_id, row.tool_run_id, RECOVERED_TOOL_RESULT_PAYLOAD)
    messageIds.add(row.message_id)
  }
  for (const messageId of messageIds) db.markMessageComplete(messageId)
  return { recoveredTools: rows.length, completedMessages: messageIds.size }
}
