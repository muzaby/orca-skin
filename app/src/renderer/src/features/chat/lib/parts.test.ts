import { describe, it, expect } from 'vitest'
import { partsText, partsReasoning, partsToolCalls, partsErrors } from './parts'
import type { AppMessagePart } from '../../../../../shared/ipc'

describe('parts selectors', () => {
  it('partsText 는 text 파트만 순서대로 잇는다', () => {
    const parts: AppMessagePart[] = [
      { type: 'text', text: 'a' },
      { type: 'reasoning', text: 'r' },
      { type: 'tool_call', toolRunId: 't1', toolName: 'Bash', args: {} },
      { type: 'text', text: 'b' }
    ]
    expect(partsText(parts)).toBe('ab')
  })

  it('partsReasoning 은 reasoning 파트를 순서대로, signature 보존', () => {
    const parts: AppMessagePart[] = [
      { type: 'reasoning', text: 'r1', signature: 's1' },
      { type: 'text', text: 'x' },
      { type: 'reasoning', text: 'r2' }
    ]
    expect(partsReasoning(parts)).toEqual([{ text: 'r1', signature: 's1' }, { text: 'r2' }])
  })

  it('partsToolCalls 는 tool_call 을 같은 toolRunId 의 tool_result 와 페어링한다', () => {
    const parts: AppMessagePart[] = [
      { type: 'tool_call', toolRunId: 't1', toolName: 'Bash', args: { cmd: 'ls' } },
      { type: 'tool_call', toolRunId: 't2', toolName: 'Read', args: { path: 'a' } },
      { type: 'tool_result', toolRunId: 't1', result: 'ok', isError: false, durationMs: 5 }
    ]
    expect(partsToolCalls(parts)).toEqual([
      {
        toolUseId: 't1',
        name: 'Bash',
        input: { cmd: 'ls' },
        result: { output: 'ok', isError: false, durationMs: 5 }
      },
      // t2 는 결과 미도착 → result 없음(실행 중)
      { toolUseId: 't2', name: 'Read', input: { path: 'a' } }
    ])
  })

  it('partsErrors 는 error 파트의 payload 를 모은다', () => {
    const parts: AppMessagePart[] = [
      { type: 'text', text: 'x' },
      { type: 'error', error: { category: 'stream_error', message: 'boom' } }
    ]
    expect(partsErrors(parts)).toEqual([{ category: 'stream_error', message: 'boom' }])
  })
})
