import { describe, expect, it } from 'vitest'
import type { AppMessagePart } from '../../../../../shared/ipc'
import type { Message } from '../reducer/chatReducer'
import { groupExchanges } from './turns'
import { createWorkToolResultSelector } from './workToolResults'

const user = (text: string): Message => ({
  role: 'user',
  createdAt: 1,
  parts: [{ type: 'text', text }]
})
const assistant = (...parts: AppMessagePart[]): Message => ({
  role: 'assistant',
  createdAt: 2,
  parts
})
const call = (toolRunId: string): AppMessagePart => ({
  type: 'tool_call',
  toolRunId,
  toolName: 'Read',
  args: {}
})
const result = (toolRunId: string, value: string): AppMessagePart => ({
  type: 'tool_result',
  toolRunId,
  result: value,
  isError: false
})

describe('Work session tool results by owning exchange', () => {
  it('joins a result beyond a confirmed user boundary only to its original call', () => {
    const messages = [
      user('first'),
      assistant(call('t')),
      user('steer'),
      assistant(result('t', 'late'))
    ]
    const selected = createWorkToolResultSelector()(groupExchanges(messages))
    expect(selected.get(0)?.get('t')).toEqual({ output: 'late', isError: false })
    expect(selected.get(2)?.has('t')).toBe(false)
    expect(messages[1]!.parts).toHaveLength(1)
    expect(messages[3]!.parts).toHaveLength(1)
  })

  it('updates the affected old exchange while keeping unrelated result maps identical', () => {
    const messages = [
      user('first'),
      assistant(call('a')),
      user('second'),
      assistant(call('b'), result('b', 'done')),
      user('third'),
      assistant({ type: 'text', text: 'waiting' })
    ]
    const select = createWorkToolResultSelector()
    const before = select(groupExchanges(messages))
    const after = select(groupExchanges([...messages.slice(0, -1), assistant(result('a', 'late'))]))
    expect(after.get(0)).not.toBe(before.get(0))
    expect(after.get(2)).toBe(before.get(2))
    expect(after.get(4)).toBe(before.get(4))
    expect(after.get(0)?.get('a')?.output).toBe('late')
  })

  it('retains completed result identity when only text is appended to the same message', () => {
    const parts = [call('t'), result('t', 'done')]
    const select = createWorkToolResultSelector()
    const before = select(groupExchanges([user('first'), assistant(...parts)]))
    expect(before.get(0)?.get('t')?.output).toBe('done')
    const after = select(
      groupExchanges([user('first'), assistant(...parts, { type: 'text', text: 'new note' })])
    )
    expect(after.get(0)).toBe(before.get(0))
    expect(after.get(0)?.get('t')).toBe(before.get(0)?.get('t'))
  })

  it('uses the last actual result and does not keep a removed late result', () => {
    const original = [user('first'), assistant(call('t'), result('t', 'early'))]
    const select = createWorkToolResultSelector()
    const before = select(groupExchanges(original))
    const later = select(
      groupExchanges([...original, user('next'), assistant(result('t', 'late'))])
    )
    expect(later.get(0)?.get('t')?.output).toBe('late')
    const restored = select(groupExchanges(original))
    expect(restored.get(0)?.get('t')).toBe(before.get(0)?.get('t'))
    expect(restored.has(2)).toBe(false)
    const without = select(groupExchanges([user('first'), assistant(call('t'))]))
    expect(without.get(0)?.size).toBe(0)
  })

  it('preserves result metadata and replaces only changed result values', () => {
    const initialResult: AppMessagePart = {
      type: 'tool_result',
      toolRunId: 'a',
      result: 'old',
      isError: false,
      durationMs: 7,
      parentToolRunId: 'parent',
      structuredOutput: { ok: true },
      subagentMeta: { model: 'test' }
    }
    const select = createWorkToolResultSelector()
    const original = [user('first'), assistant(call('a'), initialResult)]
    const before = select(groupExchanges(original))
    expect(before.get(0)?.get('a')).toMatchObject({
      output: 'old',
      durationMs: 7,
      parentToolRunId: 'parent',
      structuredOutput: { ok: true },
      subagentMeta: { model: 'test' }
    })
    const after = select(
      groupExchanges([
        ...original,
        user('next'),
        assistant({ ...initialResult, result: 'failed', isError: true })
      ])
    )
    expect(after.get(0)?.get('a')).toMatchObject({ output: 'failed', isError: true, durationMs: 7 })
    expect(before.get(0)?.get('a')?.output).toBe('old')
  })

  it('does not re-read completed message parts over unrelated updates or mutate frozen input', () => {
    let reads = 0
    const parts = Object.freeze([Object.freeze(call('t')), Object.freeze(result('t', 'done'))])
    const old: Message = {
      role: 'assistant',
      createdAt: 1,
      get parts() {
        reads++
        return parts as AppMessagePart[]
      }
    }
    Object.freeze(old)
    const select = createWorkToolResultSelector()
    const initial = select(groupExchanges([user('first'), old]))
    for (let index = 0; index < 100; index++) {
      const next = select(
        groupExchanges([
          user('first'),
          old,
          user('next'),
          assistant({ type: 'text', text: String(index) })
        ])
      )
      expect(next.get(0)).toBe(initial.get(0))
    }
    expect(reads).toBe(1)
    expect(parts).toHaveLength(2)
  })

  it('returns the same outer selection when every exchange result map is unchanged', () => {
    const select = createWorkToolResultSelector()
    const messages = [user('first'), assistant(call('t'), result('t', 'done'))]
    const before = select(groupExchanges(messages))
    expect(select(groupExchanges(messages))).toBe(before)
    const empty = select([])
    expect(empty.size).toBe(0)
    expect(select([])).toBe(empty)
  })
})
