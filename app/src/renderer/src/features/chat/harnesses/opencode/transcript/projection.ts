import type { Message } from '../../../reducer/chatReducer'
import {
  hasPartsText,
  hasSegmentReasoning,
  hasSegmentText,
  messageSegments,
  partsArtifacts,
  type MessageSegment
} from '../../../lib/parts'
import { groupExchanges, type Turn, type TranscriptProjectionOptions } from '../../../lib/turns'
import { groupTools } from './toolGrouping'
import { toolKind } from '../toolPresentation'

type RowContent =
  | { kind: 'user'; turn: Turn }
  // `live` — 이 text 행의 본문은 접두(`segment.text`) 뒤에 store 의 live text 를 붙인다(행 리프가 읽는다).
  // 없음 = 확정 행. live 와 확정은 같은 행 컴포넌트로 그린다(0325 D-015).
  | { kind: 'segment'; segment: MessageSegment; streaming: boolean; live?: true }
  | { kind: 'meta'; turn: Turn; copyable: boolean; createdAt: number }
  | { kind: 'artifacts'; artifacts: ReturnType<typeof partsArtifacts> }
  | { kind: 'incomplete' }

export type TimelineRow = RowContent & { key: string; gap: 0 | 8 | 16 | 24 }

type ExchangeEntry = { exchange: ReturnType<typeof groupExchanges>[number]; prefix: string }

// live 의 유무만 — 본문은 행 리프가 store 에서 읽는다. text 는 `hasSegmentText`, reasoning 은
// `hasSegmentReasoning` 판정이다(0325 EP-2 · D-015 · D-034).
export interface TimelineLivePresence {
  text: boolean
  reasoning: boolean
  pending: boolean
}
const NO_LIVE: TimelineLivePresence = { text: false, reasoning: false, pending: false }
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
  const rows = projectEntries(entries.slice(0, -1), NO_LIVE)
  return {
    rows,
    tail: entries.slice(-1),
    index: new Map(rows.map((row, index) => [row.key, index]))
  }
}

// 현재 exchange 의 행 — live 의 유무가 바뀔 때만 다시 부른다. 직전 행은 `head.rows.at(-1)` 하나만 읽는다.
export function projectTimelineTail(head: TimelineHead, live: TimelineLivePresence): TimelineRow[] {
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

// head 행과 tail 행을 복사하지 않고 색인으로 읽는다(0325 EP-2 ⑤⑨).
export interface TimelineRows {
  readonly count: number
  at(index: number): TimelineRow
}

export function timelineRows(head: TimelineHead, tail: readonly TimelineRow[]): TimelineRows {
  const base = head.rows.length
  return {
    count: base + tail.length,
    at: (index) => (index < base ? head.rows[index] : tail[index - base])
  }
}

// live 행에 본문을 채운 사본 — 테스트·문자열 래퍼 전용. 화면은 행 리프가 store 에서 읽는다.
export function materializeTimelineRows(
  rows: readonly TimelineRow[],
  liveText: string
): TimelineRow[] {
  return rows.map((row) => {
    if (row.kind !== 'segment' || !row.live || row.segment.kind !== 'text') return row
    const { live: _live, ...committed } = row
    void _live
    return { ...committed, segment: { kind: 'text', text: row.segment.text + liveText } }
  })
}

// 문자열 live 로 행 전체를 만든다 — 유무 판정은 `messageSegments` 와 같은 정본(EP-2 ⑩).
export function projectTimeline(
  messages: Message[],
  live: { text: string; reasoning: string; pending: boolean },
  options: TranscriptProjectionOptions = {}
): TimelineRow[] {
  const head = projectTimelineHead(messages, options)
  const presence: TimelineLivePresence = {
    text: hasSegmentText(live.text),
    reasoning: hasSegmentReasoning(live.reasoning),
    pending: live.pending
  }
  return materializeTimelineRows([...head.rows, ...projectTimelineTail(head, presence)], live.text)
}

function projectEntries(
  exchanges: ExchangeEntry[],
  live: TimelineLivePresence,
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
    const segments = messageSegments(parts)
    // live 는 확정 parts 뒤에 reasoning → text 순으로 붙는 것과 같은 자리에 행을 둔다(분기 b1~b6).
    let liveIndex = -1
    if (active && live.reasoning && segments.at(-1)?.kind !== 'reasoning')
      segments.push({ kind: 'reasoning', items: [] }) // b4 숨은 segment — 뒤 text 색인 +1 (b3 은 합침)
    if (active && live.text) {
      if (segments.at(-1)?.kind !== 'text') segments.push({ kind: 'text', text: '' }) // b2
      liveIndex = segments.length - 1 // b1 은 직전 확정 text 행이 live 가 된다
    }
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
              : 16,
          ...(index === liveIndex ? { live: true as const } : {})
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
        copyable: assistant.messages.some((message) => hasPartsText(message.parts)),
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
        segment: { kind: 'text', text: '' },
        streaming: true,
        key: 'initial:text',
        gap: rows.length ? 16 : 0,
        live: true
      })
  }
  return rows
}
