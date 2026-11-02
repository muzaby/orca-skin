import type { Message } from '../../../reducer/chatReducer'
import { messageSegments, partsArtifacts, type MessageSegment } from '../../../lib/parts'
import { groupExchanges, type Turn, type TranscriptProjectionOptions } from '../../../lib/turns'
import { groupTools } from './toolGrouping'
import { toolKind } from '../toolPresentation'

type RowContent =
  | { kind: 'user'; turn: Turn }
  | { kind: 'segment'; segment: MessageSegment; streaming: boolean }
  | { kind: 'meta'; turn: Turn; copyable: boolean; createdAt: number }
  | { kind: 'artifacts'; artifacts: ReturnType<typeof partsArtifacts> }
  | { kind: 'incomplete' }

export type TimelineRow = RowContent & { key: string; gap: 0 | 8 | 16 | 24 }

type ExchangeEntry = { exchange: ReturnType<typeof groupExchanges>[number]; prefix: string }
export interface TimelineHead {
  rows: TimelineRow[]
  tail: ExchangeEntry[]
  index: Map<string, number>
}

/** Group committed messages once, preserving duplicate timestamp keys across the split. */
export function projectTimelineHead(
  messages: Message[],
  options: TranscriptProjectionOptions = {}
): TimelineHead {
  const occurrences = new Map<string, number>()
  const entries = groupExchanges(messages, options).map((exchange) => {
    const first = exchange.turns[0].messages[0]
    const base = `${first.role}:${first.createdAt}`
    const occurrence = occurrences.get(base) ?? 0
    occurrences.set(base, occurrence + 1)
    return { exchange, prefix: occurrence ? `${base}:occurrence:${occurrence}` : base }
  })
  const rows = projectEntries(entries.slice(0, -1), { text: '', reasoning: '', pending: false })
  return {
    rows,
    tail: entries.slice(-1),
    index: new Map(rows.map((row, index) => [row.key, index]))
  }
}

export function projectTimelineTail(
  head: TimelineHead,
  live: { text: string; reasoning: string; pending: boolean }
): TimelineRow[] {
  const previous = head.rows.at(-1)
  const rows = projectEntries(head.tail, live, previous ? [previous] : [])
  return previous ? rows.slice(1) : rows
}

export function timelineRowIndex(head: TimelineHead, tail: TimelineRow[], key?: string): number {
  if (key === undefined) return -1
  const index = head.index.get(key)
  if (index !== undefined) return index
  for (let i = 0; i < tail.length; i++) if (tail[i].key === key) return head.rows.length + i
  return -1
}

export function projectTimeline(
  messages: Message[],
  live: { text: string; reasoning: string; pending: boolean },
  options: TranscriptProjectionOptions = {}
): TimelineRow[] {
  const head = projectTimelineHead(messages, options)
  return [...head.rows, ...projectTimelineTail(head, live)]
}

function projectEntries(
  exchanges: ExchangeEntry[],
  live: { text: string; reasoning: string; pending: boolean },
  initial: TimelineRow[] = []
): TimelineRow[] {
  const rows: TimelineRow[] = [...initial]
  for (const [exchangeIndex, { exchange, prefix }] of exchanges.entries()) {
    const active = exchangeIndex === exchanges.length - 1 && live.pending
    const user = exchange.turns.find((turn) => turn.role === 'user')
    if (user)
      rows.push({ kind: 'user', turn: user, key: `${prefix}:user`, gap: rows.length ? 24 : 0 })
    const assistant = exchange.turns.find((turn) => turn.role === 'assistant')
    const parts = assistant?.messages.flatMap((message) => message.parts) ?? []
    if (active && live.reasoning) parts.push({ type: 'reasoning', text: live.reasoning })
    if (active && live.text) parts.push({ type: 'text', text: live.text })
    const segments = messageSegments(parts)
    for (const [index, segment] of segments.entries()) {
      // Desktop 1.19 hides reasoning summaries by default. Keep the source
      // parts and ordinal keys intact; only omit this row from the viewport.
      if (segment.kind === 'reasoning') continue
      const groups =
        segment.kind === 'tools'
          ? groupTools(segment.calls.filter((call) => toolKind(call) !== 'todo')).map(
              (calls): MessageSegment => ({ kind: 'tools', calls })
            )
          : [segment]
      for (const item of groups) {
        const previous = rows.at(-1)
        const tool = item.kind === 'tools'
        const id = tool ? `tool:${item.calls[0].toolUseId}` : `${index}:${item.kind}`
        rows.push({
          kind: 'segment',
          segment: item,
          key: `${prefix}:${id}`,
          streaming:
            active &&
            index === segments.length - 1 &&
            (item.kind === 'text' || item.kind === 'reasoning'),
          gap: !previous
            ? 0
            : tool && previous.kind === 'segment' && previous.segment.kind === 'tools'
              ? 8
              : 16
        })
      }
    }
    const artifacts = partsArtifacts(parts)
    if (artifacts.length)
      rows.push({ kind: 'artifacts', artifacts, key: `${prefix}:artifacts`, gap: 16 })
    if (assistant?.messages.some((message) => message.incomplete)) {
      rows.push({ kind: 'incomplete', key: `${prefix}:incomplete`, gap: 16 })
    }
    if (assistant && !active)
      rows.push({
        kind: 'meta',
        turn: assistant,
        copyable: assistant.messages.some((message) =>
          message.parts.some(
            (part) => part.type === 'text' && !part.parentToolRunId && part.text.trim() !== ''
          )
        ),
        createdAt: assistant.messages.at(-1)!.createdAt,
        key: `${prefix}:meta`,
        gap: 16
      })
  }
  // Initial live output may precede the first committed message.
  if (!exchanges.length) {
    if (live.text)
      rows.push({
        kind: 'segment',
        segment: { kind: 'text', text: live.text },
        streaming: true,
        key: 'initial:text',
        gap: rows.length ? 16 : 0
      })
  }
  return rows
}
