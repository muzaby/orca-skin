import { describe, it, expect } from 'vitest'
import { partsText, partsReasoning, partsToolCalls, partsErrors, messageSegments } from './parts'
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

describe('messageSegments', () => {
  it('"텍스트 → 도구 → 텍스트" 순서를 분절 보존한다', () => {
    const parts: AppMessagePart[] = [
      { type: 'text', text: '확인할게요' },
      { type: 'tool_call', toolRunId: 't1', toolName: 'Read', args: { path: 'a' } },
      { type: 'tool_result', toolRunId: 't1', result: 'ok', isError: false },
      { type: 'text', text: '완료' }
    ]
    expect(messageSegments(parts)).toEqual([
      { kind: 'text', text: '확인할게요' },
      {
        kind: 'tools',
        calls: [
          {
            toolUseId: 't1',
            name: 'Read',
            input: { path: 'a' },
            result: { output: 'ok', isError: false }
          }
        ]
      },
      { kind: 'text', text: '완료' }
    ])
  })

  it('연속 도구는 한 tools 세그먼트로 묶는다', () => {
    const parts: AppMessagePart[] = [
      { type: 'tool_call', toolRunId: 't1', toolName: 'Read', args: {} },
      { type: 'tool_result', toolRunId: 't1', result: 'a', isError: false },
      { type: 'tool_call', toolRunId: 't2', toolName: 'Read', args: {} },
      { type: 'tool_result', toolRunId: 't2', result: 'b', isError: false }
    ]
    const segs = messageSegments(parts)
    expect(segs).toHaveLength(1)
    expect(segs[0]).toMatchObject({ kind: 'tools' })
    expect((segs[0] as { calls: unknown[] }).calls).toHaveLength(2)
  })

  it('AskUserQuestion 은 개별 ask 세그먼트로 분리한다', () => {
    const parts: AppMessagePart[] = [
      { type: 'tool_call', toolRunId: 't1', toolName: 'Bash', args: {} },
      { type: 'tool_call', toolRunId: 't2', toolName: 'AskUserQuestion', args: { q: '?' } }
    ]
    const segs = messageSegments(parts)
    expect(segs.map((s) => s.kind)).toEqual(['tools', 'ask'])
  })

  it('연속 reasoning 은 한 reasoning 세그먼트로 병합한다', () => {
    const parts: AppMessagePart[] = [
      { type: 'reasoning', text: 'r1', signature: 's1' },
      { type: 'reasoning', text: 'r2' },
      { type: 'text', text: 'x' }
    ]
    expect(messageSegments(parts)).toEqual([
      { kind: 'reasoning', items: [{ text: 'r1', signature: 's1' }, { text: 'r2' }] },
      { kind: 'text', text: 'x' }
    ])
  })

  it('error / structured_output 는 개별 세그먼트, 빈 text 는 스킵', () => {
    const parts: AppMessagePart[] = [
      { type: 'text', text: '' },
      { type: 'structured_output', value: { a: 1 } },
      { type: 'error', error: { message: 'boom' } }
    ]
    expect(messageSegments(parts)).toEqual([
      { kind: 'structured', value: { a: 1 } },
      { kind: 'error', error: { message: 'boom' } }
    ])
  })

  it('빈/공백 reasoning 파트는 스킵한다(빈 사고 카드 방지)', () => {
    const parts: AppMessagePart[] = [
      { type: 'reasoning', text: '' },
      { type: 'reasoning', text: '  \n  ' },
      { type: 'text', text: 'hello' }
    ]
    expect(messageSegments(parts)).toEqual([{ kind: 'text', text: 'hello' }])
  })
})
