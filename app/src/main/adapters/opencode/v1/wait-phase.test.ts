import { describe, expect, it } from 'vitest'
import type { ChatWaitPhase, NormalizedEvent } from '../../../../shared/ipc'
import { MODEL_OUTPUT_EVENT_TYPES } from '../../../../shared/model-output'
import { OpenCodeWaitPhase } from './wait-phase'

function makeSink(): {
  calls: Array<ChatWaitPhase | null>
  sink: (phase: ChatWaitPhase | null) => void
} {
  const calls: Array<ChatWaitPhase | null> = []
  return {
    calls,
    sink: (phase) => calls.push(phase)
  }
}

describe('OpenCodeWaitPhase (0296 UT-01)', () => {
  it('R1: serverStarting() -> [{server}]', () => {
    const { calls, sink } = makeSink()
    const phase = new OpenCodeWaitPhase(sink)
    phase.serverStarting()
    expect(calls).toEqual([{ kind: 'server' }])
  })

  it('R2: connected() -> [{project}]', () => {
    const { calls, sink } = makeSink()
    const phase = new OpenCodeWaitPhase(sink)
    phase.connected()
    expect(calls).toEqual([{ kind: 'project' }])
  })

  it('R3: creatingSession() -> [{session}]', () => {
    const { calls, sink } = makeSink()
    const phase = new OpenCodeWaitPhase(sink)
    phase.creatingSession()
    expect(calls).toEqual([{ kind: 'session' }])
  })

  it('R4: admitting() -> [{mcp}]', () => {
    const { calls, sink } = makeSink()
    const phase = new OpenCodeWaitPhase(sink)
    phase.admitting()
    expect(calls).toEqual([{ kind: 'mcp' }])
  })

  it('R5: observe([delta]), sending(), accepted() -> [{send}, {model}] (initial null suppresses first observe, sending resets output flag)', () => {
    const { calls, sink } = makeSink()
    const phase = new OpenCodeWaitPhase(sink)
    phase.observe([{ type: 'message.delta' }])
    phase.sending()
    phase.accepted()
    expect(calls).toEqual([{ kind: 'send' }, { kind: 'model' }])
  })

  it('R6a: sending(), accepted() -> [{send}, {model}]', () => {
    const { calls, sink } = makeSink()
    const phase = new OpenCodeWaitPhase(sink)
    phase.sending()
    phase.accepted()
    expect(calls).toEqual([{ kind: 'send' }, { kind: 'model' }])
  })

  it('R6b: sending(), observe([delta]), accepted() -> [{send}, null] (accepted is no-op after output)', () => {
    const { calls, sink } = makeSink()
    const phase = new OpenCodeWaitPhase(sink)
    phase.sending()
    phase.observe([{ type: 'message.delta' }])
    phase.accepted()
    expect(calls).toEqual([{ kind: 'send' }, null])
  })

  it('R6c: connected(), accepted() -> [{project}] (accepted is no-op when current is project)', () => {
    const { calls, sink } = makeSink()
    const phase = new OpenCodeWaitPhase(sink)
    phase.connected()
    phase.accepted()
    expect(calls).toEqual([{ kind: 'project' }])
  })

  it('R6d: sending(), status(retry 1), accepted() -> [{send}, {retry,1}] (accepted is no-op when current is retry)', () => {
    const { calls, sink } = makeSink()
    const phase = new OpenCodeWaitPhase(sink)
    phase.sending()
    phase.status({ type: 'retry', attempt: 1, message: 'r', next: 1 })
    phase.accepted()
    expect(calls).toEqual([{ kind: 'send' }, { kind: 'retry', attempt: 1 }])
  })

  it('R7a: status({type:"retry",attempt:2,...}) -> [{retry,2}]', () => {
    const { calls, sink } = makeSink()
    const phase = new OpenCodeWaitPhase(sink)
    phase.status({ type: 'retry', attempt: 2, message: 'x', next: 1 })
    expect(calls).toEqual([{ kind: 'retry', attempt: 2 }])
  })

  it('R7b: sending(), accepted(), status(retry 1), status(busy) -> [send, model, {retry,1}, model]', () => {
    const { calls, sink } = makeSink()
    const phase = new OpenCodeWaitPhase(sink)
    phase.sending()
    phase.accepted()
    phase.status({ type: 'retry', attempt: 1, message: 'r', next: 1 })
    phase.status({ type: 'busy' })
    expect(calls).toEqual([
      { kind: 'send' },
      { kind: 'model' },
      { kind: 'retry', attempt: 1 },
      { kind: 'model' }
    ])
  })

  it('R7c: sending(), accepted(), observe([delta]), status(retry 1), status(busy) -> [send, model, null, {retry,1}, null]', () => {
    const { calls, sink } = makeSink()
    const phase = new OpenCodeWaitPhase(sink)
    phase.sending()
    phase.accepted()
    phase.observe([{ type: 'message.delta' }])
    phase.status({ type: 'retry', attempt: 1, message: 'r', next: 1 })
    phase.status({ type: 'busy' })
    expect(calls).toEqual([
      { kind: 'send' },
      { kind: 'model' },
      null,
      { kind: 'retry', attempt: 1 },
      null
    ])
  })

  it('R7d: sending(), status(busy) -> [{send}]', () => {
    const { calls, sink } = makeSink()
    const phase = new OpenCodeWaitPhase(sink)
    phase.sending()
    phase.status({ type: 'busy' })
    expect(calls).toEqual([{ kind: 'send' }])
  })

  it('R7e: status(retry 1), status(retry 2) -> emits both attempts 1 and 2', () => {
    const { calls, sink } = makeSink()
    const phase = new OpenCodeWaitPhase(sink)
    phase.status({ type: 'retry', attempt: 1, message: 'r1', next: 1 })
    phase.status({ type: 'retry', attempt: 2, message: 'r2', next: 2 })
    expect(calls).toEqual([
      { kind: 'retry', attempt: 1 },
      { kind: 'retry', attempt: 2 }
    ])
  })

  it('R7f: sending(), status({type:"idle"}) -> [{send}]', () => {
    const { calls, sink } = makeSink()
    const phase = new OpenCodeWaitPhase(sink)
    phase.sending()
    phase.status({ type: 'idle' })
    expect(calls).toEqual([{ kind: 'send' }])
  })

  it('R7g: status({type:"retry", attempt:0, ...}) -> [{retry,1}] (non-positive integer falls back to 1)', () => {
    const { calls, sink } = makeSink()
    const phase = new OpenCodeWaitPhase(sink)
    phase.status({ type: 'retry', attempt: 0, message: 'x', next: 1 })
    expect(calls).toEqual([{ kind: 'retry', attempt: 1 }])
  })

  it('R7h: status({type:"retry", attempt:2.5, ...}) -> [{retry,1}] (non-integer attempt falls back to 1)', () => {
    const { calls, sink } = makeSink()
    const phase = new OpenCodeWaitPhase(sink)
    phase.status({ type: 'retry', attempt: 2.5, message: 'x', next: 1 })
    expect(calls).toEqual([{ kind: 'retry', attempt: 1 }])
  })

  it('R8a: sending() followed by observe([e]) for each of the 5 model output event types ends with null', () => {
    const outputEvents: NormalizedEvent[] = [
      { type: 'message.delta', sessionId: 's1', delta: { text: 'a' } },
      { type: 'message.reasoning.delta', sessionId: 's1', delta: { text: 'r' } },
      { type: 'message.reasoning', sessionId: 's1', text: 'thought' },
      { type: 'message.completed', sessionId: 's1', message: { text: 'done' } },
      { type: 'tool.call.started', sessionId: 's1', toolRunId: 't1', toolName: 'Bash', args: {} }
    ]
    expect(outputEvents.map((e) => e.type)).toEqual([...MODEL_OUTPUT_EVENT_TYPES])

    for (const ev of outputEvents) {
      const { calls, sink } = makeSink()
      const phase = new OpenCodeWaitPhase(sink)
      phase.sending()
      phase.observe([ev])
      expect(calls).toEqual([{ kind: 'send' }, null])
    }
  })

  it('R8b: sending(), observe([session.updated, telemetry]) -> [{send}]', () => {
    const { calls, sink } = makeSink()
    const phase = new OpenCodeWaitPhase(sink)
    phase.sending()
    phase.observe([{ type: 'session.updated' }, { type: 'telemetry' }])
    expect(calls).toEqual([{ kind: 'send' }])
  })

  it('R9: connected(), end() -> [{project}, null]', () => {
    const { calls, sink } = makeSink()
    const phase = new OpenCodeWaitPhase(sink)
    phase.connected()
    phase.end()
    expect(calls).toEqual([{ kind: 'project' }, null])
  })

  it('R10: connected(), connected() -> [{project}] once', () => {
    const { calls, sink } = makeSink()
    const phase = new OpenCodeWaitPhase(sink)
    phase.connected()
    phase.connected()
    expect(calls).toEqual([{ kind: 'project' }])
  })

  it('R11: constructed with undefined sink, all methods run without throwing', () => {
    const phase = new OpenCodeWaitPhase(undefined)
    expect(() => {
      phase.serverStarting()
      phase.connected()
      phase.creatingSession()
      phase.admitting()
      phase.sending()
      phase.accepted()
      phase.status({ type: 'retry', attempt: 1, message: 'r', next: 1 })
      phase.status({ type: 'busy' })
      phase.status({ type: 'idle' })
      phase.observe([{ type: 'message.delta' }])
      phase.end()
    }).not.toThrow()
  })
})
