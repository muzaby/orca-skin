import { describe, expect, it } from 'vitest'
import type { AppMessagePart } from '../../../../../../../shared/ipc'
import { createWorkProjector } from '../../../lib/workActivity'
import { snapshotToArray } from '../../../lib/blockOracle.testfixture'
import {
  newTranscriptChanges,
  recordChange,
  type TranscriptChange
} from '../../../lib/transcript/changeLog'
import type { BlockSnapshot } from '../../../lib/transcript/blockList'
import type { Message, ToolCall } from '../../../reducer/chatReducer'
import { createClaudeBlockModel, type ClaudeActivityBlock, type ClaudeBlock } from './claudeBlocks'

const user = (id: string): Message => ({ id, role: 'user', createdAt: 1, parts: [text(id)] })
const assistant = (id: string, ...parts: AppMessagePart[]): Message => ({
  id,
  role: 'assistant',
  createdAt: 2,
  parts
})
const text = (value: string): AppMessagePart => ({ type: 'text', text: value })
const call = (id: string): AppMessagePart => ({
  type: 'tool_call',
  toolName: 'Read',
  toolRunId: id,
  args: {}
})
const result = (id: string, value: string): Extract<AppMessagePart, { type: 'tool_result' }> => ({
  type: 'tool_result',
  toolRunId: id,
  result: value,
  isError: false
})
const owner = (id: string, ...parts: AppMessagePart[]): Message =>
  assistant(
    id,
    { type: 'response_boundary', boundary: { id, phase: 'begin' } },
    ...parts,
    text('conclusion'),
    { type: 'response_boundary', boundary: { id, phase: 'end', outcome: 'ended' } }
  )

interface ActivityTool {
  block: ClaudeActivityBlock
  item: ClaudeActivityBlock['items'][number]
  tool: ToolCall
}

function work(messages: Message[]): {
  advance(next: Message[], change?: TranscriptChange): BlockSnapshot<ClaudeBlock>
  readonly snapshot: BlockSnapshot<ClaudeBlock>
  tools(): ActivityTool[]
  tool(id: string): ActivityTool
} {
  const model = createClaudeBlockModel({ mode: 'work', sessionKey: 'work-results' })
  let changes = recordChange(newTranscriptChanges(), { kind: 'reset', complete: true })
  let snapshot = model.advance({ messages, transcriptChanges: changes })
  return {
    advance(next: Message[], change?: TranscriptChange) {
      if (change) changes = recordChange(changes, change)
      snapshot = model.advance({ messages: next, transcriptChanges: changes })
      return snapshot
    },
    get snapshot() {
      return snapshot
    },
    tools() {
      return snapshotToArray(snapshot).flatMap((block) =>
        block.kind !== 'activity'
          ? []
          : block.items.flatMap((item) =>
              item.segment.kind === 'tools'
                ? item.segment.calls.map((tool) => ({ block, item, tool }))
                : []
            )
      )
    },
    tool(id: string) {
      const matches = this.tools().filter(({ tool }) => tool.toolUseId === id)
      expect(matches).toHaveLength(1)
      return matches[0]
    }
  }
}

describe('VP-37 Work tool results through the production activity model', () => {
  it('joins a result beyond a confirmed user boundary only to its original call', () => {
    const first = owner('owner', call('t'))
    const late = assistant('late', result('t', 'late'))
    const model = work([user('first'), first, user('steer'), late])
    expect(model.tool('t')).toMatchObject({
      block: { messageId: 'owner' },
      tool: { result: { output: 'late', isError: false } }
    })
    expect(first.parts.filter((p) => p.type === 'tool_result')).toHaveLength(0)
    expect(late.parts).toEqual([result('t', 'late')])
  })

  it('updates the original activity and preserves unrelated tool collections', () => {
    const rows = [
      user('first'),
      owner('a1', call('a')),
      user('second'),
      owner('a2', call('b'), result('b', 'done')),
      user('third'),
      owner('a3', call('c'))
    ]
    const model = work(rows)
    const before = ['a', 'b', 'c'].map((id) => model.tool(id))
    model.advance([...rows, assistant('late', result('a', 'late'))], {
      kind: 'append',
      ids: ['late']
    })
    expect(model.tool('a').block).not.toBe(before[0].block)
    expect(model.tool('a').tool.result?.output).toBe('late')
    for (const entry of before.slice(1))
      expect(model.tool(entry.tool.toolUseId).item.segment).toBe(entry.item.segment)
  })

  it('retains completed result and tool collection identity on same-message text append', () => {
    const rows = [user('first'), owner('a', call('t'), result('t', 'done'))]
    const model = work(rows)
    const before = model.tool('t')
    expect(before.tool.result?.output).toBe('done')
    const updated = { ...rows[1], parts: [...rows[1].parts, text('new note')] }
    model.advance([rows[0], updated], { kind: 'replace', id: 'a', partsFrom: rows[1].parts.length })
    expect(model.tool('t').item.segment).toBe(before.item.segment)
    expect(model.tool('t').tool.result).toBe(before.tool.result)
  })

  it('withdraws the latest result, restores the earlier object and drops a removed result', () => {
    const rows = [user('first'), owner('a', call('t'), result('t', 'early'))]
    const model = work(rows)
    const before = model.tool('t').tool.result
    const extra = [user('next'), assistant('late', result('t', 'late'))]
    model.advance([...rows, ...extra], { kind: 'append', ids: extra.map((m) => m.id) })
    expect(model.tool('t').tool.result?.output).toBe('late')
    model.advance(rows, { kind: 'remove', ids: extra.map((m) => m.id) })
    expect(model.tool('t').tool.result).toBe(before)
    expect(
      snapshotToArray(model.snapshot).some(
        (b) => 'messageId' in b && (b.messageId === 'next' || b.messageId === 'late')
      )
    ).toBe(false)
    model.advance([rows[0], owner('a', call('t'))], { kind: 'replace', id: 'a', partsFrom: 2 })
    expect(model.tool('t').tool.result).toBeUndefined()
  })

  it('preserves all metadata while replacing only the changed result value', () => {
    const metadata = {
      durationMs: 7,
      parentToolRunId: 'parent',
      structuredOutput: { ok: true },
      subagentMeta: { model: 'test' }
    }
    const initial = { ...result('a', 'old'), ...metadata }
    const rows = [
      user('first'),
      owner('owner', call('a'), initial, text('note'), call('b'), result('b', 'other'))
    ]
    const model = work(rows)
    const before = model.tool('a').tool.result
    const unrelated = model.tool('b').tool.result
    expect(before).toEqual({ output: 'old', isError: false, ...metadata })
    model.advance(
      [...rows, user('next'), assistant('late', { ...initial, result: 'failed', isError: true })],
      { kind: 'append', ids: ['next', 'late'] }
    )
    expect(model.tool('a').tool.result).toEqual({ output: 'failed', isError: true, ...metadata })
    expect(model.tool('b').tool.result).toBe(unrelated)
    expect(before?.output).toBe('old')
  })

  it('performs zero further reads of completed frozen parts across 100 unrelated updates', () => {
    const first = owner('owner', call('t'), result('t', 'done'))
    const parts = first.parts.map((p) => Object.freeze(p))
    Object.freeze(parts)
    let reads = 0
    const old = Object.freeze({
      ...first,
      get parts() {
        reads++
        return parts
      }
    })
    const prefix = [user('first'), old]
    const model = work(prefix)
    const before = model.tool('t')
    const initialReads = reads
    expect(initialReads).toBeGreaterThan(0)
    const next = user('next')
    for (let i = 0; i < 100; i++) {
      const rows = [...prefix, next, assistant('update', text(String(i)))]
      model.advance(
        rows,
        i === 0
          ? { kind: 'append', ids: ['next', 'update'] }
          : { kind: 'replace', id: 'update', partsFrom: 0 }
      )
      expect(model.tool('t').item.segment).toBe(before.item.segment)
    }
    expect(reads).toBe(initialReads)
    // The once-only parse contract belongs to the Work projector. The whole model also
    // needs initial reads for independent part keys, turn metadata and ownership indexes.
    reads = 0
    const project = createWorkProjector()
    for (let i = 0; i < 100; i++) project([old, assistant('update', text(String(i)))])
    expect(reads).toBe(1)
    expect(parts).toHaveLength(5)
  })

  it('returns the same outer snapshot for unchanged populated and empty selections', () => {
    const rows = [user('first'), owner('owner', call('t'), result('t', 'done'))]
    const model = work(rows)
    const before = model.snapshot
    expect(model.advance(rows)).toBe(before)
    const empty = model.advance([], { kind: 'remove', ids: rows.map((m) => m.id) })
    expect(empty.count).toBe(0)
    expect(model.advance([])).toBe(empty)
  })
})
