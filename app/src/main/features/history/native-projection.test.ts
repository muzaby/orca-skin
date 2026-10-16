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
