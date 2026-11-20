import { describe, expect, it } from 'vitest'
import type { AppMessagePart } from '../../../shared/ipc'
import type { NativeHistorySnapshot } from '../../adapters/common/native-history'
import type { LoadedPartRow } from '../../infra/db/types'
import { projectNativeHistory } from './native-projection'

function row(
  messageId: number,
  part: AppMessagePart,
  role: 'user' | 'assistant' = 'assistant'
): LoadedPartRow {
  const { type, ...payload } = part
  return {
    message_id: messageId,
    message_key: null,
    message_idx: messageId,
    created_at: messageId,
    role,
    complete: 1,
    part_idx: 0,
    type,
    tool_run_id: 'toolRunId' in part ? part.toolRunId : null,
    payload_json: JSON.stringify(payload)
  }
}
function snapshot(parts: AppMessagePart[] = []): NativeHistorySnapshot {
  return {
    sessionId: 's',
    cwd: '/w',
    sourceKey: 'root',
    revision: 'r',
    messages: [
      { id: 'user-native', role: 'user', createdAt: 1, parts: [{ type: 'text', text: 'same' }] },
      { id: 'assistant-native', sourceIds: ['a2'], role: 'assistant', createdAt: 2, parts }
    ]
  }
}

describe('native history projection', () => {
  it('matches sidecars by IDs, keeps every merged attachment, preserves orphan sidecars and live tail', () => {
    const source = snapshot([{ type: 'text', text: 'latest' }])
    const parts: LoadedPartRow[] = [
      row(1, { type: 'text', text: 'same' }, 'user'),
      row(1, { type: 'attachment', attachments: [{ id: 'one' }] } as AppMessagePart, 'user'),
      row(2, { type: 'attachment', attachments: [{ id: 'two' }] } as AppMessagePart, 'user'),
      row(3, { type: 'text', text: 'same' }, 'user'),
      row(3, { type: 'attachment', attachments: [{ id: 'orphan' }] } as AppMessagePart, 'user'),
      row(4, { type: 'text', text: 'live' })
    ]
    const original = structuredClone({ source, parts })
    const result = projectNativeHistory(
      source,
      parts,
      [
        { message_id: 1, native_message_id: 'user-native' },
        { message_id: 2, native_message_id: 'user-native' }
      ],
      3
    )
    expect(result.orphaned).toBe(true)
    expect(result.messages).toHaveLength(4)
    expect(result.messages[0].parts).toHaveLength(3)
    expect(result.messages[2].parts).toEqual([
      { type: 'attachment', attachments: [{ id: 'orphan' }] }
    ])
    expect(result.messages[3].parts).toEqual([{ type: 'text', text: 'live' }])
    expect({ source, parts }).toEqual(original)
  })

  it('enriches matching tool identities without replacing native output and retains child calls', () => {
    const source = snapshot([
      { type: 'tool_call', toolRunId: 'parent', toolName: 'Task', args: {} },
      { type: 'tool_result', toolRunId: 'parent', result: 'new', isError: false }
    ])
    const child: AppMessagePart = {
      type: 'tool_call',
      parentToolRunId: 'parent',
      toolRunId: 'child',
      toolName: 'Read',
      args: { file_path: '/a' }
    }
    const childResult: AppMessagePart = {
      type: 'tool_result',
      parentToolRunId: 'parent',
      toolRunId: 'child',
      result: 'content',
      isError: false
    }
    const sourceBefore = structuredClone(source)
    const result = projectNativeHistory(
      source,
      [
        row(1, {
          type: 'tool_result',
          toolRunId: 'parent',
          result: 'old',
          isError: false,
          durationMs: 42
        }),
        row(1, child),
        row(1, childResult),
        row(1, { type: 'text', parentToolRunId: 'parent', text: 'child answer' }),
        row(1, {
          type: 'tool_result',
          toolRunId: 'parent',
          parentToolRunId: 'different',
          result: 'wrong',
          isError: false
        })
      ],
      [],
      1
    )
    expect(result.messages[1].parts[1]).toMatchObject({ result: 'new', durationMs: 42 })
    expect(result.messages[1].parts).toContainEqual(child)
    expect(result.messages[1].parts).toContainEqual(childResult)
    expect(result.orphaned).toBe(true)
    expect(source).toEqual(sourceBefore)
  })

  it('restores question answers and plan corrections using exact tool IDs', () => {
    const source = snapshot([
      { type: 'tool_call', toolRunId: 'ask', toolName: 'AskUserQuestion', args: {} },
      { type: 'tool_call', toolRunId: 'plan', toolName: 'ExitPlanMode', args: {} }
    ])
    const result = projectNativeHistory(
      source,
      [
        row(1, {
          type: 'tool_result',
          toolRunId: 'ask',
          result: { answers: { q: 'yes' } },
          isError: false
        }),
        row(1, {
          type: 'tool_call',
          toolRunId: 'plan',
          toolName: 'ExitPlanMode',
          args: { plan: 'confirmed' }
        })
      ],
      [],
      1
    )
    expect(result.messages[1].parts).toContainEqual({
      type: 'tool_result',
      toolRunId: 'ask',
      result: { answers: { q: 'yes' } },
      isError: false
    })
    expect(result.messages[1].parts[1]).toMatchObject({ args: { plan: 'confirmed' } })
  })
})

it('keeps the latest bound native ID stable when earlier history is prepended', () => {
  const original = snapshot()
  const parts: LoadedPartRow[] = [
    { ...row(10, { type: 'text', text: 'owned' }), message_key: 'a:owner' },
    { ...row(11, { type: 'text', text: 'other' }), message_key: 'a:other' },
    row(12, { type: 'text', text: 'local tail' })
  ]
  const bindings = [
    { message_id: 10, native_message_id: 'user-native' },
    { message_id: 10, native_message_id: 'a2' },
    { message_id: 11, native_message_id: 'assistant-native' }
  ]
  const ids = (value: NativeHistorySnapshot): string[] =>
    projectNativeHistory(value, parts, bindings, 11).messages.map(({ id }) => id)
  expect(ids(original)).toEqual(['n:user-native', 'a:owner', 'm:12'])
  expect(
    ids({
      ...original,
      messages: [{ id: 'before', role: 'assistant', createdAt: 0, parts: [] }, ...original.messages]
    })
  ).toEqual(['n:before', 'n:user-native', 'a:owner', 'm:12'])
})

describe('VP-05 load identity rules (i1~i8)', () => {
  it('retains separate native, orphan and tail identities across an alias-only binding and prepend', () => {
    const source = snapshot()
    const rows = [
      { ...row(4, { type: 'text', text: 'archive' }), message_key: 'a:bound' },
      {
        ...row(4, { type: 'text', text: 'orphan', parentToolRunId: 'absent' }),
        message_key: 'a:bound'
      },
      row(6, { type: 'text', text: 'live' }),
      row(6, { type: 'reasoning', text: 'second part' })
    ]
    const bindings = [
      { message_id: 4, native_message_id: 'absent' },
      { message_id: 4, native_message_id: 'a2' },
      { message_id: 6, native_message_id: 'user-native' }
    ]
    const project = (input: NativeHistorySnapshot): Array<[string, AppMessagePart['type'][]]> =>
      projectNativeHistory(input, rows, bindings, 4).messages.map(({ id, parts }) => [
        id,
        parts.map((part) => part.type)
      ])
    const expected = [
      ['n:user-native', ['text']],
      ['a:bound', []],
      ['a:bound#o', ['text']],
      ['m:6', ['text', 'reasoning']]
    ]
    expect(project(source)).toEqual(expected)
    expect(
      project({
        ...source,
        messages: [
          { id: 'n:prefix#o', role: 'assistant', createdAt: 0, parts: [] },
          ...source.messages
        ]
      })
    ).toEqual([['n:n%3Aprefix%23o', []], ...expected])
  })

  it('uses native order for aliases and the smaller database ID on a tie, independent of binding order', () => {
    const source = snapshot()
    const bindings = [
      { message_id: 9, native_message_id: 'a2' },
      { message_id: 9, native_message_id: 'user-native' },
      { message_id: 12, native_message_id: 'assistant-native' },
      { message_id: 13, native_message_id: 'user-native' }
    ]
    const rows = [
      { ...row(12, { type: 'text', text: 'later row' }), message_key: 'a:twelve' },
      row(9, { type: 'text', text: 'legacy row' }),
      { ...row(13, { type: 'text', text: 'live tail' }), message_key: 'a:tail' }
    ]
    for (const order of [bindings, [...bindings].reverse()]) {
      expect(projectNativeHistory(source, rows, order, 12).messages.map((m) => m.id)).toEqual([
        'n:user-native',
        'm:9',
        'a:tail'
      ])
    }
    // A row exactly at the frontier can own its native ID even without a competing row.
    expect(projectNativeHistory(source, [rows[0]], bindings, 12).messages.map((m) => m.id)).toEqual(
      ['n:user-native', 'a:twelve']
    )
  })

  it('i1~i5, i7, i8 assign deterministic unique IDs across bound, unbound, orphan, tie-break, and prepend', () => {
    const source: NativeHistorySnapshot = {
      sessionId: 's',
      cwd: '/w',
      sourceKey: 'root',
      revision: 'r1',
      messages: [
        { id: 'nat-1', role: 'user', createdAt: 1, parts: [{ type: 'text', text: 'u1' }] },
        { id: 'nat-2', role: 'assistant', createdAt: 2, parts: [{ type: 'text', text: 'a1' }] },
        { id: 'nat-3', role: 'assistant', createdAt: 3, parts: [{ type: 'text', text: 'a2' }] },
        { id: 'nat-unbound', role: 'assistant', createdAt: 4, parts: [{ type: 'text', text: 'u' }] }
      ]
    }
    const parts: LoadedPartRow[] = [
      // Row 10 has message_key -> bound to nat-1, nat-2, nat-3 -> latest is nat-3 (i1, i4)
      { ...row(10, { type: 'text', text: 'a2' }), message_key: 'a:key10' },
      // Row 11 also has nat-3 as latest -> smaller DB id (10) wins (i7)
      { ...row(11, { type: 'text', text: 'dup' }), message_key: 'a:key11' },
      // Row 12 is an orphan below frontier (12 <= 12) -> value#o (i5)
      {
        ...row(
          12,
          { type: 'attachment', attachments: [{ id: 'orph-att' }] } as AppMessagePart,
          'user'
        ),
        message_key: 'a:orph'
      },
      // Row 13 is local tail without message_key -> m:13 (i2)
      row(13, { type: 'text', text: 'tail' })
    ]
    const bindings = [
      { message_id: 10, native_message_id: 'nat-1' },
      { message_id: 10, native_message_id: 'nat-2' },
      { message_id: 10, native_message_id: 'nat-3' },
      { message_id: 11, native_message_id: 'nat-3' }
    ]
    const first = projectNativeHistory(source, parts, bindings, 12)
    const firstIds = first.messages.map((m) => m.id)
    // i4: nat-1 & nat-2 -> n:..., nat-3 -> a:key10; i3: nat-unbound -> n:nat-unbound; i5: orphan -> a:orph#o; i2: tail -> m:13
    expect(firstIds).toEqual(['n:nat-1', 'n:nat-2', 'a:key10', 'n:nat-unbound', 'a:orph#o', 'm:13'])
    // All IDs unique
    expect(new Set(firstIds).size).toBe(firstIds.length)

    // i8: prepending native messages keeps all existing IDs unchanged and unique
    const prepended = projectNativeHistory(
      {
        ...source,
        messages: [
          { id: 'nat-0', role: 'user', createdAt: 0, parts: [{ type: 'text', text: 'pre' }] },
          ...source.messages
        ]
      },
      parts,
      bindings,
      12
    )
    const prependedIds = prepended.messages.map((m) => m.id)
    expect(prependedIds).toEqual(['n:nat-0', ...firstIds])
    expect(new Set(prependedIds).size).toBe(prependedIds.length)
  })
})
