import { describe, expect, it } from 'vitest'
import type { AppMessagePart, LoadedSession, NormalizedEvent } from '../../../../../shared/ipc'
import type { NonExecution } from '../../../../../shared/tool-outcome'
import { chatReducer, initialChatState, type ToolCall } from '../reducer/chatReducer'
import {
  deriveSubagentTaskStatus,
  messageSegments,
  partsToolCalls,
  reconcileSegments
} from './parts'
import { createWorkProjector } from './workActivity'

const rejected: NonExecution = { source: 'sdk', kind: 'user-rejected' }
const cancelled: NonExecution = { source: 'sdk', kind: 'cancelled' }
const call: AppMessagePart = { type: 'tool_call', toolRunId: 't', toolName: 'Read', args: {} }
const receipt = (nonExecution?: NonExecution): AppMessagePart => ({
  type: 'tool_result',
  toolRunId: 't',
  result: 'same output',
  isError: true,
  durationMs: 5,
  ...(nonExecution ? { nonExecution } : {})
})

describe('0239 nonExecution renderer contract', () => {
  it.each([
    ['user-rejected', 'rejected'],
    ['permission-rule', 'rejected'],
    ['automode-blocked', 'rejected'],
    ['automode-unavailable', 'rejected'],
    ['automode-parsing-error', 'rejected'],
    ['cancelled', 'cancelled'],
    ['interrupted', 'aborted'],
    ['future-kind', 'not_executed']
  ])('classifies SDK %s as %s', (kind, outcome) => {
    expect(
      deriveSubagentTaskStatus(partsToolCalls([call, receipt({ source: 'sdk', kind })])[0])
    ).toBe(outcome)
  })
  it.each(['no_result', 'retracted'] as const)('classifies host %s as not executed', (kind) => {
    expect(
      deriveSubagentTaskStatus(partsToolCalls([call, receipt({ source: 'host', kind })])[0])
    ).toBe('not_executed')
  })
  it.each([
    [undefined, 'running'],
    [{ output: 'ok', isError: false }, 'completed'],
    [{ output: 'bad', isError: true }, 'failed'],
    [{ output: { reason: 'aborted' }, isError: true }, 'aborted'],
    [{ output: { status: 'async_launched' }, isError: false }, 'running']
  ] as const)('preserves existing result classification %#', (result, outcome) => {
    expect(deriveSubagentTaskStatus({ toolUseId: 't', name: 'Agent', input: {}, result })).toBe(
      outcome
    )
  })
  it('preserves the same metadata through live reducer and LOAD_SESSION', () => {
    const events: NormalizedEvent[] = [
      { type: 'tool.call.started', sessionId: 's', toolRunId: 't', toolName: 'Read', args: {} },
      {
        type: 'tool.call.completed',
        sessionId: 's',
        toolRunId: 't',
        result: 'same output',
        isError: true,
        durationMs: 5,
        nonExecution: rejected
      }
    ]
    const live = events.reduce(
      (s, event) => chatReducer(s, { type: 'RECV_EVENT', event }),
      chatReducer(initialChatState, { type: 'BEGIN_TURN' })
    )
    const loaded = chatReducer(initialChatState, {
      type: 'LOAD_SESSION',
      session: {
        id: 's',
        messages: [{ role: 'assistant', createdAt: 1, parts: [call, receipt(rejected)] }]
      } as LoadedSession
    })
    const liveCall = partsToolCalls(live.messages.flatMap((m) => m.parts))[0]
    const loadedCall = partsToolCalls(loaded.messages.flatMap((m) => m.parts))[0]
    expect(liveCall.result?.nonExecution).toEqual(rejected)
    expect(loadedCall.result).toEqual(liveCall.result)
  })

  it.each<[string, NonExecution | undefined, NonExecution | undefined]>([
    ['addition', undefined, rejected],
    ['replacement', rejected, cancelled],
    ['removal', rejected, undefined]
  ])('reconciles %s in transcript and Work without changing the body', (_label, before, after) => {
    let state = chatReducer(initialChatState, { type: 'BEGIN_TURN' })
    state = chatReducer(state, {
      type: 'RECV_EVENT',
      event: {
        type: 'tool.call.started',
        sessionId: 's',
        toolRunId: 't',
        toolName: 'Read',
        args: {}
      }
    })
    const completed = (nonExecution?: NonExecution): NormalizedEvent => ({
      type: 'tool.call.completed',
      sessionId: 's',
      toolRunId: 't',
      result: 'same output',
      isError: true,
      durationMs: 5,
      ...(nonExecution ? { nonExecution } : {})
    })
    state = chatReducer(state, { type: 'RECV_EVENT', event: completed(before) })
    const parts = state.messages.at(-1)!.parts
    const prev = messageSegments(parts)
    state = chatReducer(state, { type: 'RECV_EVENT', event: completed(after) })
    const updatedParts = state.messages.at(-1)!.parts
    const next = reconcileSegments(prev, messageSegments(updatedParts))
    if (next[0].kind !== 'tools') throw new Error('tools')
    expect(next[0].calls[0].result?.nonExecution).toEqual(after)
    const project = createWorkProjector()
    const boundary: AppMessagePart = {
      type: 'response_boundary',
      boundary: { phase: 'begin', id: 'r' }
    }
    project([{ role: 'assistant', createdAt: 1, parts: [boundary, ...parts] }])
    const nodes = project([
      { role: 'assistant', createdAt: 1, parts: [boundary, ...updatedParts] }
    ])!
    const activity = nodes.find((node) => node.kind === 'activity')!
    const segment = activity.items[0].segment
    expect(segment.kind).toBe('tools')
    if (segment.kind !== 'tools') throw new Error('expected tool segment')
    expect(segment.calls[0].result?.nonExecution).toEqual(after)
  })
  it('reuses equal values and unchanged siblings but replaces changed feedback', () => {
    const sibling = { ...call, toolRunId: 'sibling' }
    const prev = messageSegments([call, sibling, receipt(rejected)])
    expect(
      reconcileSegments(prev, messageSegments([call, sibling, receipt({ ...rejected })]))
    ).toBe(prev)
    const next = reconcileSegments(
      prev,
      messageSegments([call, sibling, receipt({ ...rejected, userFeedback: 'later' })])
    )
    if (prev[0].kind !== 'tools' || next[0].kind !== 'tools') throw new Error('tools')
    expect(next[0].calls[0]).not.toBe(prev[0].calls[0])
    expect(next[0].calls[1]).toBe(prev[0].calls[1])
  })
  it('reconciles the ask segment through the same result equality', () => {
    const ask = { ...call, toolName: 'AskUserQuestion' }
    const prev = messageSegments([ask, receipt(rejected)])
    const next = reconcileSegments(prev, messageSegments([ask, receipt(cancelled)]))
    expect(next[0]).not.toBe(prev[0])
    expect(next[0]).toMatchObject({ kind: 'ask', call: { result: { nonExecution: cancelled } } })
  })
  it('ignores malformed persisted metadata', () => {
    const invalid = {
      ...receipt(),
      nonExecution: { source: 'host', kind: 'unknown' }
    } as unknown as AppMessagePart
    const result = partsToolCalls([call, invalid])[0].result as ToolCall['result']
    expect(deriveSubagentTaskStatus({ toolUseId: 't', name: 'Read', input: {}, result })).toBe(
      'failed'
    )
  })
})
