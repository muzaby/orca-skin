import { describe, it, expect } from 'vitest'
import { messageSegments, reconcileSegments } from './parts'
import type { AppMessagePart } from '../../../../../shared/ipc'

// 도구 2개 + 선행 텍스트가 있는 진행 중 assistant 메시지의 parts.
const base: AppMessagePart[] = [
  { type: 'text', text: '먼저 살펴볼게요.' },
  { type: 'tool_call', toolRunId: 't1', toolName: 'Read', args: { path: 'a.ts' } },
  { type: 'tool_call', toolRunId: 't2', toolName: 'Bash', args: { command: 'ls' } }
]

describe('reconcileSegments', () => {
  it('내용 미변경 세그먼트는 prev 의 identity 를 재사용하고, 전부 같으면 prev 배열 자체를 반환한다', () => {
    const prev = messageSegments(base)
    const next = messageSegments(base) // 호출마다 새 객체
    expect(next[0]).not.toBe(prev[0])
    const out = reconcileSegments(prev, next)
    expect(out).toBe(prev)
  })

  it('tool_result 도착 시 해당 ToolCall 만 새 객체 — 형제 call/세그먼트는 identity 유지', () => {
    const prev = reconcileSegments(null, messageSegments(base))
    const grown: AppMessagePart[] = [
      ...base,
      { type: 'tool_result', toolRunId: 't1', result: 'data', isError: false }
    ]
    const out = reconcileSegments(prev, messageSegments(grown))

    // text 세그먼트는 그대로.
    expect(out[0]).toBe(prev[0])
    // tools 세그먼트는 교체되지만(결과 반영) —
    const prevTools = prev[1]
    const outTools = out[1]
    if (prevTools.kind !== 'tools' || outTools.kind !== 'tools') throw new Error('kind')
    expect(outTools).not.toBe(prevTools)
    // — 결과가 도착한 t1 만 새 객체, t2 는 identity 재사용 (형제 카드 memo bail 의 근거).
    expect(outTools.calls[0]).not.toBe(prevTools.calls[0])
    expect(outTools.calls[0].result).toEqual({ output: 'data', isError: false })
    expect(outTools.calls[1]).toBe(prevTools.calls[1])
  })

  it('새 세그먼트 추가(도구 뒤 텍스트)는 기존 세그먼트 identity 에 영향 없다', () => {
    const prev = reconcileSegments(null, messageSegments(base))
    const grown: AppMessagePart[] = [...base, { type: 'text', text: '결과를 보면…' }]
    const out = reconcileSegments(prev, messageSegments(grown))
    expect(out).toHaveLength(3)
    expect(out[0]).toBe(prev[0])
    expect(out[1]).toBe(prev[1])
    expect(out[2]).toEqual({ kind: 'text', text: '결과를 보면…' })
  })

  it('prev 가 없으면 next 를 그대로 반환한다', () => {
    const next = messageSegments(base)
    expect(reconcileSegments(null, next)).toBe(next)
  })
})
