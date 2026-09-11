import { describe, expect, it } from 'vitest'
import { messageSegments, partsToolCalls } from './parts'
import { chatReducer, initialChatState } from '../reducer/chatReducer'
import type { AppMessagePart } from '../../../../../shared/ipc'

const editPreview = { structuredPatch: [{ oldStart: 45, oldLines: 1, newStart: 45, newLines: 1 }] }

const parts: AppMessagePart[] = [
  { type: 'tool_call', toolRunId: 't1', toolName: 'Edit', args: { file_path: 'a.ts' }, editPreview }
]

// 0229 VP-Δ7 — 이벤트에 실은 값이 **트랜스크립트 카드가 읽는 view** 까지 도달해야 한다.
// 파생 생성자가 셋이라 하나만 고치면 카드가 보는 경로만 조용히 빠진다.
describe('실행 전 미리보기의 파생 경로', () => {
  it('tool_call 파트 → ToolCall view 생성자 전부가 미리보기를 싣는다', () => {
    expect(partsToolCalls(parts)[0].editPreview).toEqual(editPreview)

    const segment = messageSegments(parts)[0]
    expect(segment.kind).toBe('tools')
    if (segment.kind !== 'tools') throw new Error('tools 세그먼트여야 한다')
    expect(segment.calls[0].editPreview).toEqual(editPreview)
  })

  it('started 이벤트가 파트까지 미리보기를 나른다', () => {
    const next = chatReducer(initialChatState, {
      type: 'RECV_EVENT',
      event: {
        type: 'tool.call.started',
        sessionId: 's1',
        toolRunId: 't1',
        toolName: 'Edit',
        args: { file_path: 'a.ts' },
        editPreview
      }
    })
    const part = next.messages.at(-1)?.parts.at(-1)
    expect(part?.type).toBe('tool_call')
    expect(part?.type === 'tool_call' ? part.editPreview : undefined).toEqual(editPreview)
  })

  it('미리보기가 없는 도구는 필드를 만들지 않는다', () => {
    const plain: AppMessagePart[] = [
      { type: 'tool_call', toolRunId: 't2', toolName: 'Read', args: {} }
    ]
    expect(Object.hasOwn(partsToolCalls(plain)[0], 'editPreview')).toBe(false)
  })
})
