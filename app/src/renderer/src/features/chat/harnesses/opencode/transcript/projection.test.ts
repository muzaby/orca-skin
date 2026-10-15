import { describe, expect, it } from 'vitest'
import type { Message } from '../../../reducer/chatReducer'
import { projectTimeline } from './projection'
import { messageSegments } from '../../../lib/parts'

const user: Message = { role: 'user', createdAt: 10, parts: [{ type: 'text', text: 'prompt' }] }
const idle = { text: '', reasoning: '', pending: false }
describe('OpenCode timeline projection', () => {
  it('distinguishes same-timestamp exchanges and preserves their keys when unrelated history is prepended', () => {
    const answer: Message = {
      role: 'assistant',
      createdAt: 11,
      parts: [{ type: 'text', text: 'answer' }]
    }
    const messages = [
      user,
      answer,
      { ...user, parts: [{ type: 'text' as const, text: 'second prompt' }] },
      answer
    ]
    const rows = projectTimeline(messages, idle)
    expect(new Set(rows.map((row) => row.key)).size).toBe(rows.length)
    expect(rows.filter((row) => row.kind === 'user').map((row) => row.key)).toEqual([
      'user:10:user',
      'user:10:occurrence:1:user'
    ])
    const prepended = projectTimeline(
      [{ ...user, createdAt: 1 }, { ...answer, createdAt: 2 }, ...messages],
      idle
    )
    expect(prepended.slice(-rows.length).map((row) => row.key)).toEqual(rows.map((row) => row.key))
  })
  it('preserves all nine segment kinds, input/result, and original ordering', () => {
    const assistant: Message = {
      role: 'assistant',
      createdAt: 20,
      parts: [
        { type: 'text', text: 'first' },
        { type: 'reasoning', text: 'why' },
        { type: 'tool_call', toolRunId: 'read1', toolName: 'Read', args: { file_path: 'a.ts' } },
        { type: 'tool_result', toolRunId: 'read1', result: 'source', isError: false },
        {
          type: 'tool_call',
          toolRunId: 'ask1',
          toolName: 'AskUserQuestion',
          args: { questions: [] }
        },
        { type: 'structured_output', value: { ok: true } },
        { type: 'error', error: { message: 'failed' } },
        { type: 'compact_boundary', trigger: 'auto' },
        { type: 'fork_boundary' },
        { type: 'subagent_notice', toolRunId: 'task1', status: 'completed', summary: 'done' }
      ]
    }
    const rows = projectTimeline([user, assistant], idle)
    const segments = rows.flatMap((row) => (row.kind === 'segment' ? [row.segment] : []))
    expect(segments.map((row) => row.kind)).toEqual([
      'text',
      'reasoning',
      'tools',
      'ask',
      'structured',
      'error',
      'compact',
      'fork',
      'subagent_notice'
    ])
    expect(segments[2]).toMatchObject({
      calls: [
        {
          toolUseId: 'read1',
          input: { file_path: 'a.ts' },
          result: { output: 'source', isError: false }
        }
      ]
    })
  })
  it('keeps text and tool keys across streaming completion and history prepend', () => {
    const live = projectTimeline([user], { ...idle, text: 'hello', pending: true })
    const assistant: Message = {
      role: 'assistant',
      createdAt: 20,
      parts: [{ type: 'text', text: 'hello' }]
    }
    const completed = projectTimeline([user, assistant], idle)
    expect(live.find((row) => row.kind === 'segment')!.key).toBe(
      completed.find((row) => row.kind === 'segment')!.key
    )
    const older: Message = { ...user, createdAt: 1 }
    const prepended = projectTimeline(
      [older, { ...assistant, createdAt: 2 }, user, assistant],
      idle
    )
    expect(prepended.slice(-completed.length).map((row) => row.key)).toEqual(
      completed.map((row) => row.key)
    )
    const call: Message = {
      role: 'assistant',
      createdAt: 20,
      parts: [
        { type: 'tool_call', toolRunId: 'run', toolName: 'Bash', args: { command: 'echo hi' } }
      ]
    }
    const running = projectTimeline([user, call], { ...idle, pending: true })
    const done = projectTimeline(
      [
        user,
        {
          ...call,
          parts: [
            ...call.parts,
            { type: 'tool_result', toolRunId: 'run', result: 'hi', isError: false }
          ]
        }
      ],
      idle
    )
    expect(running[1].key).toBe(done[1].key)
  })
  it('hides only OpenCode Todo rows without mutating raw parts or Claude projection', () => {
    const assistant: Message = {
      role: 'assistant',
      createdAt: 20,
      parts: [
        {
          type: 'tool_call',
          toolRunId: 'todo',
          toolName: 'TodoWrite',
          args: { todos: [{ content: 'one', status: 'pending' }] }
        },
        { type: 'tool_result', toolRunId: 'todo', result: 'updated', isError: false },
        { type: 'text', text: 'working' }
      ]
    }
    const original = structuredClone(assistant.parts)
    expect(
      projectTimeline([user, assistant], idle)
        .filter((row) => row.kind === 'segment')
        .map((row) => row.segment.kind)
    ).toEqual(['text'])
    expect(assistant.parts).toEqual(original)
    expect(messageSegments(assistant.parts).map((segment) => segment.kind)).toEqual([
      'tools',
      'text'
    ])
  })
  it('uses 8px between tool rows, 16px at content boundaries and 24px between turns', () => {
    const assistant: Message = {
      role: 'assistant',
      createdAt: 20,
      parts: [
        { type: 'tool_call', toolRunId: 'read', toolName: 'Read', args: {} },
        { type: 'tool_call', toolRunId: 'shell', toolName: 'Bash', args: {} },
        { type: 'text', text: 'answer' }
      ]
    }
    const rows = projectTimeline([user, assistant, { ...user, createdAt: 30 }], idle)
    expect(rows.map((row) => row.gap)).toEqual([0, 16, 8, 16, 16, 24])
  })
})
