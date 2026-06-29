import { describe, expect, it, vi } from 'vitest'
import { RECOVERED_TOOL_RESULT_PAYLOAD, recoverDanglingToolCalls } from './recovery'

describe('recoverDanglingToolCalls', () => {
  it('writes DB-only aborted tool_result and completes each assistant message once', () => {
    const db = {
      findDanglingToolCalls: vi.fn(() => [
        { message_id: 1, session_id: 's1', tool_run_id: 't1', payload_json: '{}' },
        { message_id: 1, session_id: 's1', tool_run_id: 't2', payload_json: '{}' },
        { message_id: 2, session_id: 's1', tool_run_id: 't3', payload_json: '{}' }
      ]),
      upsertToolResultPart: vi.fn(),
      markMessageComplete: vi.fn()
    }

    const report = recoverDanglingToolCalls(db)

    expect(report).toEqual({ recoveredTools: 3, completedMessages: 2 })
    expect(db.upsertToolResultPart).toHaveBeenCalledWith(1, 't1', RECOVERED_TOOL_RESULT_PAYLOAD)
    expect(db.upsertToolResultPart).toHaveBeenCalledWith(1, 't2', RECOVERED_TOOL_RESULT_PAYLOAD)
    expect(db.upsertToolResultPart).toHaveBeenCalledWith(2, 't3', RECOVERED_TOOL_RESULT_PAYLOAD)
    expect(db.markMessageComplete).toHaveBeenCalledTimes(2)
    expect(db.markMessageComplete).toHaveBeenCalledWith(1)
    expect(db.markMessageComplete).toHaveBeenCalledWith(2)
  })
})
