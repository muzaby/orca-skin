import { readFileSync } from 'node:fs'
import { expect, it, vi } from 'vitest'
import type { Message } from '../../../reducer/chatReducer'
import * as turns from '../../../lib/turns'
import {
  projectTimeline,
  projectTimelineHead,
  projectTimelineTail,
  timelineRowIndex
} from './projection'
const cases = JSON.parse(
  readFileSync(new URL('./projection.golden.json', import.meta.url), 'utf8')
) as Array<{
  messages: Message[]
  live: { text: string; reasoning: string; pending: boolean }
  rows: unknown[]
}>
it.each(cases)('matches original keys, gaps, tools, artifacts and incomplete rows %#', (input) => {
  const rows = projectTimeline(input.messages, input.live).map((row) => {
    if (row.kind !== 'meta') return row
    const { turn, copyable, ...rest } = row
    expect(copyable).toBe(turns.turnCopyText(turn) !== '')
    return { ...rest, text: turns.turnCopyText(turn) }
  })
  expect(rows).toEqual(input.rows)
})
it('keeps head rows and indexed positions stable as only the live tail changes, without eager copy text', () => {
  const copy = vi.spyOn(turns, 'turnCopyText')
  const input = cases[2],
    head = projectTimelineHead(input.messages)
  for (const text of ['one', 'two', 'three', 'four', 'five']) {
    const tail = projectTimelineTail(head, { ...input.live, text })
    const rows = [...head.rows, ...tail]
    for (const [index, row] of rows.entries())
      expect(timelineRowIndex(head, tail, row.key)).toBe(index)
    expect(timelineRowIndex(head, tail, 'missing')).toBe(-1)
    expect(head.rows.every((row, index) => rows[index] === row)).toBe(true)
  }
  expect(copy).not.toHaveBeenCalled()
  copy.mockRestore()
})

it.each([
  [{ type: 'text', text: '   ' }],
  [{ type: 'text', text: 'child', parentToolRunId: 'child-run' }],
  [{ type: 'text', text: 'empty child id is main text', parentToolRunId: '' }],
  [{ type: 'text', text: 'main text' }]
] as const)('derives meta copyability from the same text semantics as turnCopyText: %j', (part) => {
  const rows = projectTimeline([{ role: 'assistant', createdAt: 1, parts: [part] }], {
    text: '',
    reasoning: '',
    pending: false
  })
  const meta = rows.find((row) => row.kind === 'meta')!
  if (meta.kind !== 'meta') throw new Error('missing meta')
  expect(meta.copyable).toBe(turns.turnCopyText(meta.turn) !== '')
})
