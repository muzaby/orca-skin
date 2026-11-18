import { describe, expect, it } from 'vitest'
import type { Message } from '../../../reducer/chatReducer'
import {
  projectTimeline,
  projectTimelineHead,
  projectTimelineTail,
  timelineRows
} from './projection'
import { messageSegments } from '../../../lib/parts'

const user: Message = { role: 'user', createdAt: 10, parts: [{ type: 'text', text: 'prompt' }] }
const idle = { text: '', reasoning: '', pending: false }
describe('OpenCode timeline projection', () => {
  it('uses the original visible message keys and indexes when reminders are hidden or revealed', () => {
    const reminder: Message = {
      role: 'user',
      createdAt: 1,
      parts: [
        {
          type: 'text',
          text: '<system-reminder>internal</system-reminder>',
          origin: { kind: 'automatic' }
        }
      ]
    }
    const answer: Message = {
      role: 'assistant',
      createdAt: 11,
      parts: [{ type: 'text', text: 'answer' }]
    }
    const mixed: Message = { ...user, parts: [...reminder.parts, ...user.parts] }
    const baseline = projectTimeline([user, answer], idle)
    const source = [reminder, mixed, answer]
    const original = structuredClone(source)
    for (const showAutomaticFeeds of [false, true]) {
      const rows = projectTimeline(source, idle, { showAutomaticFeeds })
      expect(rows.map((row) => row.key)).toEqual(
        showAutomaticFeeds
          ? ['user:1:user', 'user:1:0:text', 'user:1:meta']
          : baseline.map((row) => row.key)
      )
      const userRow = rows[0]
      expect(userRow.kind).toBe('user')
      if (userRow.kind !== 'user') throw new Error('missing visible user row')
      expect(userRow.key).toBe(showAutomaticFeeds ? 'user:1:user' : 'user:10:user')
      expect(userRow.turn.startIndex).toBe(showAutomaticFeeds ? 0 : 1)
      if (showAutomaticFeeds) {
        expect(userRow.turn.messages).toEqual([reminder, mixed])
        expect(userRow.turn.messages[0]).toBe(reminder)
        expect(userRow.turn.messages[1]).toBe(mixed)
      } else {
        expect(userRow.turn.messages[0].parts).toEqual(user.parts)
      }
      expect(source).toEqual(original)
    }
  })

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
  it('omits reasoning from display while preserving input/result and the visible order', () => {
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
      'tools',
      'ask',
      'error',
      'compact',
      'fork',
      'subagent_notice'
    ])
    expect(segments[1]).toMatchObject({
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
  it('keeps reasoning in the source and stable visible keys during live, commit and prepend', () => {
    const parts: Message['parts'] = [
      { type: 'reasoning', text: 'Private intermediate notes' },
      { type: 'text', text: 'Visible answer' }
    ]
    const assistant: Message = { role: 'assistant', createdAt: 20, parts }
    const original = structuredClone(parts)
    const streaming = projectTimeline([user], {
      text: 'Visible answer',
      reasoning: 'Private intermediate notes',
      pending: true
    })
    const completed = projectTimeline([user, assistant], idle)
    expect(streaming.filter((row) => row.kind === 'segment').map((row) => row.key)).toEqual(
      completed.filter((row) => row.kind === 'segment').map((row) => row.key)
    )
    expect(
      completed.filter((row) => row.kind === 'segment').map((row) => row.segment.kind)
    ).toEqual(['text'])
    expect(parts).toEqual(original)
    expect(messageSegments(parts).map((segment) => segment.kind)).toEqual(['reasoning', 'text'])
    expect(projectTimeline([], { ...idle, reasoning: 'only reasoning', pending: true })).toEqual([])
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

// 0325 VP-08 — presence tail 을 문자열 래퍼(`projectTimeline` = head + presence tail + materialize)로 보아
// 규칙 칸 분기 b1~b9 마다 지금 투영의 기대값(key · 본문 · streaming · 행 종류)과 대조한다.
describe('presence tail ≡ string tail', () => {
  const q: Message = { role: 'user', createdAt: 1, parts: [{ type: 'text', text: 'q' }] }
  const answer = (parts: Message['parts']): Message => ({ role: 'assistant', createdAt: 2, parts })
  const shape = (rows: ReturnType<typeof projectTimeline>): unknown[] =>
    rows.map((row) =>
      row.kind === 'segment'
        ? [
            row.key,
            row.segment.kind === 'text' ? row.segment.text : row.segment.kind,
            row.streaming
          ]
        : [row.key, row.kind]
    )

  it('b1 pending · text 유무 · 직전 segment 가 text → 그 행이 live(접두 + live, key 그대로)', () => {
    const rows = projectTimeline([q, answer([{ type: 'text', text: 'pre' }])], {
      text: 'X',
      reasoning: '',
      pending: true
    })
    expect(shape(rows)).toEqual([
      ['user:1:user', 'user'],
      ['user:1:0:text', 'preX', true]
    ])
  })

  it("b1′ 공백뿐인 live text 도 text 유무다(`hasSegmentText` 는 '' 만 거짓)", () => {
    const rows = projectTimeline([q, answer([{ type: 'text', text: 'pre' }])], {
      text: ' ',
      reasoning: '',
      pending: true
    })
    expect(shape(rows)).toEqual([
      ['user:1:user', 'user'],
      ['user:1:0:text', 'pre ', true]
    ])
  })

  it('b2 pending · text 유무 · 직전 segment 가 text 아님 → 새 행 `${prefix}:${segments.length}:text`', () => {
    const rows = projectTimeline(
      [q, answer([{ type: 'tool_call', toolRunId: 'r1', toolName: 'Read', args: {} }])],
      { text: 'X', reasoning: '', pending: true }
    )
    expect(shape(rows)).toEqual([
      ['user:1:user', 'user'],
      ['user:1:tool:r1', 'tools', false],
      ['user:1:1:text', 'X', true]
    ])
  })

  it('b3 pending · reasoning 유무 · 직전 segment 가 reasoning → 합침(색인 불변)', () => {
    const rows = projectTimeline([q, answer([{ type: 'reasoning', text: 'think' }])], {
      text: 'X',
      reasoning: 'more',
      pending: true
    })
    expect(shape(rows)).toEqual([
      ['user:1:user', 'user'],
      ['user:1:1:text', 'X', true]
    ])
  })

  it('b4 pending · reasoning 유무 · 직전이 reasoning 아님 → 숨은 segment(뒤 text 색인 +1)', () => {
    const rows = projectTimeline([q, answer([{ type: 'text', text: 'pre' }])], {
      text: 'X',
      reasoning: 'r',
      pending: true
    })
    expect(shape(rows)).toEqual([
      ['user:1:user', 'user'],
      ['user:1:0:text', 'pre', false],
      ['user:1:2:text', 'X', true]
    ])
  })

  it('b5 공백뿐인 live reasoning → segment 없음', () => {
    const rows = projectTimeline([q, answer([{ type: 'text', text: 'pre' }])], {
      text: 'X',
      reasoning: ' \n ',
      pending: true
    })
    expect(shape(rows)).toEqual([
      ['user:1:user', 'user'],
      ['user:1:0:text', 'preX', true]
    ])
  })

  it('b6 pending 거짓 → live 무시(exchange 가 있을 때)', () => {
    const rows = projectTimeline([q, answer([{ type: 'text', text: 'pre' }])], {
      text: 'X',
      reasoning: 'r',
      pending: false
    })
    expect(shape(rows)).toEqual([
      ['user:1:user', 'user'],
      ['user:1:0:text', 'pre', false],
      ['user:1:meta', 'meta']
    ])
  })

  it('b7 exchange 0 · text 유무 → `initial:text` live 행(pending 무관, reasoning 무시)', () => {
    for (const pending of [true, false]) {
      expect(shape(projectTimeline([], { text: 'X', reasoning: 'r', pending }))).toEqual([
        ['initial:text', 'X', true]
      ])
      expect(projectTimeline([], { text: '', reasoning: 'r', pending })).toEqual([])
    }
  })

  it('b8 pending · live 없음 · 마지막 확정 text → streaming 참 · b9 pending → meta 없음', () => {
    const rows = projectTimeline([q, answer([{ type: 'text', text: 'pre' }])], {
      text: '',
      reasoning: '',
      pending: true
    })
    expect(shape(rows)).toEqual([
      ['user:1:user', 'user'],
      ['user:1:0:text', 'pre', true]
    ])
    expect(rows.some((row) => row.kind === 'meta')).toBe(false)
  })
})

// 0325 EP-2 ⑤⑨ — 행은 head 를 복사하지 않고 색인으로 읽는다.
describe('timelineRows', () => {
  it('reads head rows by index without copying or iterating them', () => {
    const q: Message = { role: 'user', createdAt: 1, parts: [{ type: 'text', text: 'q' }] }
    const a: Message = { role: 'assistant', createdAt: 2, parts: [{ type: 'text', text: 'a' }] }
    const head = projectTimelineHead([q, a, { ...q, createdAt: 3 }, { ...a, createdAt: 4 }])
    const tail = projectTimelineTail(head, { text: true, reasoning: false, pending: true })
    let iterations = 0
    const guarded = new Proxy(head.rows, {
      get(source, key, receiver) {
        if (typeof key === 'symbol' || !/^(\d+|length|at)$/.test(key)) iterations++
        return Reflect.get(source, key, receiver)
      }
    })
    const rows = timelineRows({ ...head, rows: guarded }, tail)
    expect(rows.count).toBe(head.rows.length + tail.length)
    const read = Array.from({ length: rows.count }, (_, index) => rows.at(index))
    expect(read).toEqual([...head.rows, ...tail])
    expect(read[0]).toBe(head.rows[0])
    expect(read.at(-1)).toBe(tail.at(-1))
    expect(iterations).toBe(0)
  })
})
