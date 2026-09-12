import { describe, expect, it } from 'vitest'
import { createWorkProjector } from './workActivity'
import type { Message } from '../reducer/chatReducer'
import type { AppMessagePart } from '../../../../../shared/ipc'

const text = (value: string): AppMessagePart => ({ type: 'text', text: value })
const begin = (id: string): AppMessagePart => ({
  type: 'response_boundary',
  boundary: { phase: 'begin', id }
})
const end = (
  id: string,
  outcome: 'ended' | 'failed' | 'aborted' | 'unknown' = 'ended'
): AppMessagePart => ({ type: 'response_boundary', boundary: { phase: 'end', id, outcome } })
const tool: AppMessagePart = { type: 'tool_call', toolRunId: 't', toolName: 'Read', args: {} }
const message = (...parts: AppMessagePart[]): Message => ({
  role: 'assistant',
  createdAt: 1,
  parts
})
describe('Work response projection', () => {
  it('keeps legacy history untouched and does not invent empty activity for text-only responses', () => {
    const project = createWorkProjector()
    expect(project([message(text('legacy'))])).toBeNull()
    const result = project([message(begin('r'), text('plain'), end('r'))])!
    expect(result.filter((node) => node.kind === 'activity')).toEqual([])
    expect(result.filter((node) => node.kind === 'segment')).toHaveLength(1)
  })
  it('keeps intermediate notes inside one tool timeline in original order', () => {
    const result = createWorkProjector()([
      message(
        begin('r'),
        text('intro'),
        tool,
        text('note'),
        { ...tool, toolRunId: 't2' },
        { type: 'reasoning', text: 'secret reasoning' },
        text('final'),
        end('r')
      )
    ])!
    expect(result.map((node) => node.kind)).toEqual([
      'segment',
      'activity',
      'segment',
      'segment',
      'status'
    ])
    const activities = result.filter((node) => node.kind === 'activity')
    expect(activities.map((node) => node.toolCount)).toEqual([2])
    expect(activities.map((node) => node.noteCount)).toEqual([1])
    expect(activities.flatMap((node) => node.items.map((item) => item.segment.kind))).toEqual([
      'tools',
      'text',
      'tools'
    ])
    expect(activities[0].items[1]).toMatchObject({ segment: { kind: 'text', text: 'note' } })
    expect(result.at(-1)).toMatchObject({ outcome: 'ended' })
  })
  it.each(['failed', 'aborted', 'unknown'] as const)(
    'keeps partial text visible with its %s response status',
    (outcome) => {
      const result = createWorkProjector()([
        message(begin('r'), tool, text('partial'), end('r', outcome))
      ])!
      expect(result.filter((node) => node.kind === 'segment')).toMatchObject([
        { segment: { kind: 'text', text: 'partial' } }
      ])
      expect(result.at(-1)).toMatchObject({ outcome })
    }
  )
  it('counts separate notes across messages in the same response without changing their original parts', () => {
    const notes = [message(text('note one')), message(text('note two'))]
    const originalParts = notes.map((note) => note.parts)
    const result = createWorkProjector()([
      message(begin('r'), text('intro'), tool),
      ...notes,
      message({ ...tool, toolRunId: 't2' }, text('final'), end('r'))
    ])!
    const activity = result.find((node) => node.kind === 'activity')!
    expect(activity).toMatchObject({ toolCount: 2, noteCount: 2 })
    expect(activity.items.map((item) => item.segment.kind)).toEqual([
      'tools',
      'text',
      'text',
      'tools'
    ])
    expect(notes.map((note) => note.parts)).toEqual(originalParts)
    expect(notes[0].parts).toBe(originalParts[0])
  })
  it.each<AppMessagePart>([
    { type: 'reasoning', text: 'thought' },
    { ...tool, toolRunId: 'q', toolName: 'AskUserQuestion' },
    { type: 'error', error: 'problem' },
    { type: 'structured_output', value: { safe: true } },
    { type: 'compact_boundary', trigger: 'manual', preTokens: 1 },
    { type: 'fork_boundary' }
  ])('keeps text outside a group when protected $type separates the next tool', (protectedPart) => {
    const result = createWorkProjector()([
      message(
        begin('r'),
        tool,
        text('before protection'),
        protectedPart,
        text('after protection'),
        { ...tool, toolRunId: 't2' },
        text('final'),
        end('r')
      )
    ])!
    const activities = result.filter((node) => node.kind === 'activity')
    expect(activities.map((node) => node.noteCount)).toEqual([0, 0])
    expect(
      result.filter((node) => node.kind === 'segment' && node.segment.kind === 'text')
    ).toMatchObject([
      { segment: { text: 'before protection' } },
      { segment: { text: 'after protection' } },
      { segment: { text: 'final' } }
    ])
  })
  it('keeps activity keys and note identity through a live next tool and a late result', () => {
    const project = createWorkProjector()
    const first = message(begin('r'), tool, text('becomes a note'))
    const before = project([first])!
    const beforeActivity = before.find((node) => node.kind === 'activity')!
    expect(beforeActivity.noteCount).toBe(0)
    const next = message({ ...tool, toolRunId: 't2' }, text('final'), end('r'))
    const after = project([first, next])!
    const activity = after.find((node) => node.kind === 'activity')!
    expect(activity.key).toBe(beforeActivity.key)
    expect(activity.items[0].segment).toBe(beforeActivity.items[0].segment)
    expect(activity.noteCount).toBe(1)
    const late = project([
      first,
      next,
      message({ type: 'tool_result', toolRunId: 't', result: 'late result', isError: false })
    ])!
    const lateActivity = late.find((node) => node.kind === 'activity')!
    expect(lateActivity.key).toBe(activity.key)
    expect(lateActivity.items[1]).toBe(activity.items[1])
    expect(lateActivity.items[0].segment).toMatchObject({
      calls: [{ result: { output: 'late result' } }]
    })
    expect(late.find((node) => node.kind === 'segment')).toBe(
      after.find((node) => node.kind === 'segment')
    )
  })
  it('preserves prior conclusion when background response and late original tool result arrive', () => {
    const first = message(begin('first'), tool, text('final'), end('first'))
    const project = createWorkProjector()
    const original = project([first])!
    const later = project([first, message(begin('notice'), text('later'), end('notice'))])!
    expect(later.find((node) => node.key === original[1].key)).toBe(original[1])
    expect(
      project([
        message(begin('first'), tool, text('final'), end('first'), {
          type: 'tool_result',
          toolRunId: 't',
          result: 'late',
          isError: false
        })
      ])!.filter((node) => node.kind === 'segment')
    ).toHaveLength(1)
  })
  it('leaves questions/errors independent and unclosed response explicitly unknown', () => {
    const result = createWorkProjector()([
      message(
        begin('r'),
        tool,
        { ...tool, toolRunId: 'q', toolName: 'AskUserQuestion' },
        { type: 'error', error: 'failed' },
        text('partial')
      )
    ])!
    expect(
      result.filter((node) => node.kind === 'segment').map((node) => node.segment.kind)
    ).toEqual(['ask', 'error', 'text'])
    expect(result.at(-1)).toMatchObject({ outcome: 'unknown' })
  })
  it('joins late results stored in a separate DB message without reclassifying the closed conclusion', () => {
    const original = message(begin('r'), tool, text('final'), end('r'))
    const late = message({
      type: 'tool_result',
      toolRunId: 't',
      result: 'actual-late-result',
      isError: false
    })
    const project = createWorkProjector()
    const before = project([original])!
    const after = project([original, late])!
    const activity = after.find((node) => node.kind === 'activity')!
    if (activity.kind !== 'activity') throw Error('activity expected')
    expect(activity.items[0].segment).toMatchObject({
      calls: [{ result: { output: 'actual-late-result' } }]
    })
    expect(after.find((node) => node.kind === 'segment')).toBe(
      before.find((node) => node.kind === 'segment')
    )
  })
  it('keeps reasoning outside activity and never creates a zero-tool summary', () => {
    const result = createWorkProjector()([
      message(
        begin('r'),
        { type: 'reasoning', text: 'thought' },
        text('intro'),
        tool,
        text('final'),
        end('r')
      )
    ])!
    expect(result[0]).toMatchObject({ kind: 'segment', segment: { kind: 'reasoning' } })
    expect(result.filter((node) => node.kind === 'activity')).toHaveLength(1)
  })
  it('keeps completed tool views when only the last message text changes', () => {
    const result: AppMessagePart = {
      type: 'tool_result',
      toolRunId: 't',
      result: { message: 'done' },
      isError: false
    }
    const first = message(begin('r'), tool, result, text('a'))
    const project = createWorkProjector()
    const before = project([first])!.find((node) => node.kind === 'activity')!
    const after = project([{ ...first, parts: [...first.parts, text('b')] }])!.find(
      (node) => node.kind === 'activity'
    )!
    if (before.kind !== 'activity' || after.kind !== 'activity') throw Error('activity expected')
    expect(after.items[0].segment).toBe(before.items[0].segment)
  })
  it('does not parse unchanged completed messages over 100 current-message updates', () => {
    let reads = 0
    const previous = Array.from({ length: 100 }, (_, index) => {
      const value = message(begin(String(index)), tool, text('done'), end(String(index)))
      return {
        ...value,
        get parts() {
          reads++
          return value.parts
        }
      }
    })
    const project = createWorkProjector()
    project(previous)
    const initial = reads
    for (let i = 0; i < 100; i++)
      project([...previous, message(begin('live'), tool, text(String(i)))])
    expect(reads).toBe(initial)
  })
})
