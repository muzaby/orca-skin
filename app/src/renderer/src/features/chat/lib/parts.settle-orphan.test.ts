import { describe, it, expect } from 'vitest'
import type { AppMessagePart } from '../../../../../shared/ipc'
import { settleOrphanToolParts, partsToolCalls, isAbortedResult } from './parts'

describe('settleOrphanToolParts (Q2 — 미완료 메시지 열린 도구 보정)', () => {
  it('tool_result 없는 tool_call 에 aborted tool_result 를 붙여 "중단됨"으로 만든다', () => {
    const parts: AppMessagePart[] = [
      { type: 'text', text: '실행할게요' },
      { type: 'tool_call', toolRunId: 't1', toolName: 'Bash', args: { command: 'ls' } }
    ]
    const settled = settleOrphanToolParts(parts)
    const calls = partsToolCalls(settled)
    expect(calls).toHaveLength(1)
    expect(calls[0].result).toBeDefined()
    expect(calls[0].result!.isError).toBe(true)
    expect(isAbortedResult(calls[0].result)).toBe(true)
  })

  it('이미 tool_result 가 있는 tool_call 은 건드리지 않는다 (원본 배열 그대로 반환)', () => {
    const parts: AppMessagePart[] = [
      { type: 'tool_call', toolRunId: 't1', toolName: 'Bash', args: null },
      { type: 'tool_result', toolRunId: 't1', result: { ok: true }, isError: false }
    ]
    expect(settleOrphanToolParts(parts)).toBe(parts)
  })

  it('tool_call 이 없으면 원본 배열 그대로 반환한다 (no-op)', () => {
    const parts: AppMessagePart[] = [{ type: 'text', text: '안녕' }]
    expect(settleOrphanToolParts(parts)).toBe(parts)
  })

  it('AskUserQuestion 미응답도 중단으로 정착한다', () => {
    const parts: AppMessagePart[] = [
      { type: 'tool_call', toolRunId: 'ask1', toolName: 'AskUserQuestion', args: { questions: [] } }
    ]
    const calls = partsToolCalls(settleOrphanToolParts(parts))
    expect(calls[0].result).toBeDefined()
    expect(isAbortedResult(calls[0].result)).toBe(true)
  })

  it('child(서브에이전트) 도구 orphan 의 합성 결과는 parentToolRunId 를 보존한다', () => {
    const parts: AppMessagePart[] = [
      { type: 'tool_call', toolRunId: 'c1', toolName: 'Bash', args: null, parentToolRunId: 'p1' }
    ]
    const settled = settleOrphanToolParts(parts)
    const result = settled.find((p) => p.type === 'tool_result')
    expect(result).toMatchObject({ type: 'tool_result', toolRunId: 'c1', parentToolRunId: 'p1' })
  })
})
