import { describe, expect, it } from 'vitest'
import type { DanglingToolCallRow } from '../infra/db/types'
import {
  ABORTED_TOOL_RESULT_PAYLOAD,
  groupDanglingToolCallsByMessage,
  recoverDanglingToolCalls
} from './recovery'

function row(messageId: number, toolRunId: string, sessionId = 's1'): DanglingToolCallRow {
  return {
    session_id: sessionId,
    message_id: messageId,
    tool_run_id: toolRunId,
    payload_json: JSON.stringify({ name: 'Tool', input: {} })
  }
}

describe('recoverDanglingToolCalls', () => {
  it('writes message-scoped aborted results and completes each message once', () => {
    const writes: Array<[number, string, string]> = []
    const completed: number[] = []
    const summary = recoverDanglingToolCalls({
      findDanglingToolCalls: () => [row(1, 'a'), row(1, 'b'), row(2, 'c')],
      upsertToolResultPartScoped: (messageId, toolRunId, payloadJson) => {
        writes.push([messageId, toolRunId, payloadJson])
      },
      markMessageComplete: (messageId) => completed.push(messageId)
    })

    expect(writes).toEqual([
      [1, 'a', ABORTED_TOOL_RESULT_PAYLOAD],
      [1, 'b', ABORTED_TOOL_RESULT_PAYLOAD],
      [2, 'c', ABORTED_TOOL_RESULT_PAYLOAD]
    ])
    expect(completed).toEqual([1, 2])
    expect(summary).toEqual({ messagesCompleted: 2, toolResultsWritten: 3 })
  })

  it('skips sessions that currently have a live runtime', () => {
    const writes: string[] = []
    const summary = recoverDanglingToolCalls(
      {
        findDanglingToolCalls: () => [row(1, 'a', 'live'), row(2, 'b', 'dead')],
        upsertToolResultPartScoped: (_messageId, toolRunId) => writes.push(toolRunId),
        markMessageComplete: () => {}
      },
      { isSessionLive: (sessionId) => sessionId === 'live' }
    )

    expect(writes).toEqual(['b'])
    expect(summary).toEqual({ messagesCompleted: 1, toolResultsWritten: 1 })
  })

  it('groups dangling rows by assistant message', () => {
    const grouped = groupDanglingToolCallsByMessage([row(1, 'a'), row(1, 'b'), row(2, 'c')])
    expect(grouped.get(1)?.map((r) => r.tool_run_id)).toEqual(['a', 'b'])
    expect(grouped.get(2)?.map((r) => r.tool_run_id)).toEqual(['c'])
  })
})
