import type { DbQueries } from '../../infra/db'
import type { DanglingToolCallRow } from '../../infra/db/types'

export const ABORTED_TOOL_RESULT_PAYLOAD = JSON.stringify({
  result: { reason: 'aborted', message: '중단되었습니다' },
  isError: true
})

interface RecoverDanglingToolCallsOptions {
  sessionId?: string
  isSessionLive?: (sessionId: string) => boolean
}

interface RecoverySummary {
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

// finalize(마감 시 1회 content 기록, 0107) 이전에 턴이 끝난 assistant 메시지는 content
// (FTS5 캐시)가 비어 검색에서 빠진다. 최상위 text 파트(payload.parentToolRunId 부재 —
// 서브에이전트 child 텍스트 제외)를 concat 해 재구성한다. recoverDanglingToolCalls 가
// complete 를 올리기 *전* 에 호출해야 한다(complete=0 이 대상 식별자).
export function rebuildIncompleteMessageContent(
  db: Pick<DbQueries, 'findIncompleteAssistantTextParts' | 'updateMessageContent'>,
  options: { sessionId?: string } = {}
): number {
  const rows = db.findIncompleteAssistantTextParts(options.sessionId)
  const byMessage = new Map<number, string>()
  for (const row of rows) {
    let payload: { text?: unknown; parentToolRunId?: unknown }
    try {
      payload = JSON.parse(row.payload_json) as { text?: unknown; parentToolRunId?: unknown }
    } catch {
      continue
    }
    if (typeof payload.text !== 'string' || payload.parentToolRunId !== undefined) continue
    byMessage.set(row.message_id, (byMessage.get(row.message_id) ?? '') + payload.text)
  }
  let rebuilt = 0
  for (const [messageId, content] of byMessage) {
    if (content === '') continue
    db.updateMessageContent(messageId, content)
    rebuilt += 1
  }
  return rebuilt
}

// 세션 히스토리 복구의 단일 진입점 — "rebuild(content 재구성) → recover(dangling 도구 정산)"
// 순서 불변식을 콜러가 아니라 여기서 소유한다. rebuild 가 먼저다: recover 가 complete 를
// 올리면 complete=0 을 대상 식별자로 쓰는 rebuild 가 대상을 찾지 못한다(0107).
// live 세션은 진행 턴의 finalize 가 곧 기록하므로 건너뛴다(두 단계 동일 가드).
export function recoverSessionHistory(
  db: Pick<
    DbQueries,
    | 'findIncompleteAssistantTextParts'
    | 'updateMessageContent'
    | 'findDanglingToolCalls'
    | 'upsertToolResultPartScoped'
    | 'markMessageComplete'
  >,
  options: RecoverDanglingToolCallsOptions = {}
): RecoverySummary {
  const { sessionId, isSessionLive } = options
  if (!(sessionId !== undefined && isSessionLive?.(sessionId))) {
    rebuildIncompleteMessageContent(db, sessionId !== undefined ? { sessionId } : {})
  }
  return recoverDanglingToolCalls(db, options)
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
