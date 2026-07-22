// wire-log (0124) — 스위치 게이트·sink 주입·델타 2종 전 경로 배제(사용자 결정 2026-07-18) 검증.

import { afterEach, describe, expect, it, vi } from 'vitest'
import { setWireLog, setWireSink, stripMessageContent, wireLog } from './wire-log'

afterEach(() => {
  setWireLog(false)
  setWireSink(null)
})

describe('wireLog', () => {
  it('does not emit when the switch is off (default)', () => {
    const sink = vi.fn()
    setWireSink(sink)
    wireLog('message.completed', { text: 'hi' })
    expect(sink).not.toHaveBeenCalled()
  })

  it('does not emit when no sink is injected', () => {
    setWireLog(true)
    expect(() => wireLog('message.completed', {})).not.toThrow()
  })

  it('emits label and payload to the sink when enabled', () => {
    const sink = vi.fn()
    setWireSink(sink)
    setWireLog(true)
    const ev = { type: 'tool.call.started', sessionId: 's1' }
    wireLog('tool.call.started', ev)
    expect(sink).toHaveBeenCalledTimes(1)
    expect(sink).toHaveBeenCalledWith('tool.call.started', ev)
  })

  it('excludes streaming delta events on every path', () => {
    const sink = vi.fn()
    setWireSink(sink)
    setWireLog(true)
    wireLog('message.delta', { delta: { text: 'a' } })
    wireLog('message.reasoning.delta', { delta: { text: 'b' } })
    expect(sink).not.toHaveBeenCalled()
    // 델타가 아닌 고빈도 이벤트(telemetry·subagent.task)는 유지된다(사용자 결정 ②).
    wireLog('telemetry', {})
    wireLog('subagent.task', { phase: 'progress' })
    expect(sink).toHaveBeenCalledTimes(2)
  })

  it('stops emitting after the switch turns off again', () => {
    const sink = vi.fn()
    setWireSink(sink)
    setWireLog(true)
    wireLog('input.echo', { uuid: 'u1' })
    setWireLog(false)
    wireLog('input.echo', { uuid: 'u2' })
    expect(sink).toHaveBeenCalledTimes(1)
  })
})

// 0144 — prod wire sink 의 메시지 본문 제거(비내용 메타는 유지).
describe('stripMessageContent', () => {
  it('drops message body from message.completed but keeps metadata', () => {
    const out = stripMessageContent({
      type: 'message.completed',
      sessionId: 's1',
      message: { text: 'secret conversation' },
      parentToolRunId: 'run-9'
    })
    expect(out).toEqual({ type: 'message.completed', sessionId: 's1', parentToolRunId: 'run-9' })
  })

  it('drops reasoning/echo/queued text content, keeps identifiers', () => {
    expect(
      stripMessageContent({
        type: 'message.reasoning',
        sessionId: 's',
        text: 'x',
        signature: 'sig'
      })
    ).toEqual({
      type: 'message.reasoning',
      sessionId: 's',
      signature: 'sig'
    })
    expect(stripMessageContent({ type: 'input.echo', text: 'hi', uuid: 'u1' })).toEqual({
      type: 'input.echo',
      uuid: 'u1'
    })
    expect(
      stripMessageContent({
        type: 'message.committed',
        sessionId: 's',
        text: 't',
        attachmentViews: [{}],
        messageId: 3,
        createdAt: 1
      })
    ).toEqual({ type: 'message.committed', sessionId: 's', messageId: 3, createdAt: 1 })
  })

  it('keeps non-message events (tool call) intact except content keys', () => {
    const out = stripMessageContent({
      type: 'tool.call.started',
      sessionId: 's',
      toolRunId: 'r1',
      toolName: 'Bash',
      args: { command: 'ls' }
    })
    // 도구 I/O(args)는 요구 3 범위 밖 — 유지(redaction 이 별도 마스킹). 내용 키만 제거.
    expect(out).toEqual({
      type: 'tool.call.started',
      sessionId: 's',
      toolRunId: 'r1',
      toolName: 'Bash',
      args: { command: 'ls' }
    })
  })

  it('passes through non-object values unchanged', () => {
    expect(stripMessageContent(undefined)).toBeUndefined()
    expect(stripMessageContent('str')).toBe('str')
    expect(stripMessageContent(null)).toBeNull()
  })
})
