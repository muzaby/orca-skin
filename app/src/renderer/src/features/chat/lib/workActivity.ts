import type { MarkdownSourcePart } from '../../../shared/ui/markdown/sourceParts'
import type { AppMessagePart } from '../../../../../shared/ipc'
import type { ResponseBoundary } from '../../../../../shared/response-boundary'
import type { Message, ToolCall } from '../reducer/chatReducer'
import { resultMap, type MessageSegment } from './parts'
import { createSegmentCache } from './segmentCache'
import {
  activityBlockKey,
  partBlockKey,
  representativePart,
  textPartGroups,
  type MultiPartGroupRef,
  toolBlockKey,
  type PartKeyEntry
} from './transcript/blockKeys'

export type WorkToolResultsMap = ReadonlyMap<string, NonNullable<ToolCall['result']>>

type SegmentNode = {
  kind: 'segment'
  key: string
  messageId: string
  segment: MessageSegment
  sourceParts?: readonly MarkdownSourcePart[]
}
type BoundaryNode = { kind: 'boundary'; key: string; boundary: ResponseBoundary }
type Atom = SegmentNode | BoundaryNode
export type WorkActivityNode =
  | SegmentNode
  | {
      kind: 'activity'
      key: string
      items: SegmentNode[]
      toolCount: number
      noteCount: number
    }
  | { kind: 'status'; key: string; outcome: 'ended' | 'aborted' | 'failed' | 'unknown' }

function segmentKeyFor(
  messageId: string,
  segment: MessageSegment,
  counters: Map<string, number>
): string {
  if (segment.kind === 'tools' && segment.calls.length > 0) {
    return toolBlockKey(messageId, segment.calls[0].toolUseId)
  }
  if (segment.kind === 'ask') {
    return toolBlockKey(messageId, segment.call.toolUseId)
  }
  const kind = segment.kind
  const seq = counters.get(kind) ?? 0
  counters.set(kind, seq + 1)
  return partBlockKey(messageId, kind, seq)
}

function firstToolRunIdInActivity(items: readonly SegmentNode[]): string | null {
  for (const item of items) {
    if (item.segment.kind === 'tools' && item.segment.calls.length > 0) {
      return item.segment.calls[0].toolUseId
    }
    if (item.segment.kind === 'ask') {
      return item.segment.call.toolUseId
    }
  }
  return null
}

// 턴 인스턴스 소유 캐시. 완료 메시지의 parts는 재해석하지 않고 변경 메시지만 투영한다.
// 원문/도구 payload는 복제하지 않는다. 캐시 수명은 transcript 턴의 수명과 같다.
export function createWorkProjector(
  entriesFor?: (message: Message) => readonly PartKeyEntry[]
): (messages: readonly Message[], toolResults?: WorkToolResultsMap) => WorkActivityNode[] | null {
  type Parsed = { atoms: Atom[]; results: ReturnType<typeof resultMap> }
  const cache = new WeakMap<Message, Parsed>()
  const previous = new Map<
    string,
    { atoms: Atom[]; caches: Map<number, ReturnType<typeof createSegmentCache>> }
  >()
  const joined = new WeakMap<SegmentNode, SegmentNode>()
  const resultViews = new WeakMap<AppMessagePart, NonNullable<ToolCall['result']>>()
  function parse(message: Message, index: number): Parsed {
    const cached = cache.get(message)
    if (cached) return cached
    const parts = message.parts
    const results = new Map<string, NonNullable<ToolCall['result']>>()
    for (const part of parts) {
      if (part.type !== 'tool_result') continue
      const value = resultViews.get(part) ?? resultMap([part]).get(part.toolRunId)
      if (!value) continue
      resultViews.set(part, value)
      results.set(part.toolRunId, value)
    }
    const atoms: Atom[] = []
    let chunk: AppMessagePart[] = []
    let offset = 0
    let chunkStart = 0
    const entries = entriesFor?.(message) ?? []
    let entryCursor = 0
    const identity = message.id ?? `m:${index}`
    const prior = previous.get(identity)
    const caches = new Map<number, ReturnType<typeof createSegmentCache>>()
    const oldByKey = new Map<string, SegmentNode>()
    const textRefs: MultiPartGroupRef[] = []
    for (const node of prior?.atoms ?? []) {
      if (node.kind !== 'segment') continue
      oldByKey.set(node.key, node)
      if (node.sourceParts) {
        textRefs.push({
          key: node.key,
          repPartKey: node.key,
          partKeys: new Set(node.sourceParts.map((part) => part.key))
        })
      }
    }
    const counters = new Map<string, number>()
    let boundarySeq = 0
    function flush(chunkEnd: number): void {
      const segmentCache = prior?.caches.get(offset) ?? createSegmentCache()
      caches.set(offset, segmentCache)
      const segments = segmentCache.segmentsFor({ ...message, parts: chunk }, undefined, results)
      const start = entryCursor
      while (entryCursor < entries.length && entries[entryCursor].partIndex < chunkEnd) {
        entryCursor++
      }
      const groups = textPartGroups(
        entries.slice(start, entryCursor).filter((entry) => entry.partIndex >= chunkStart)
      )
      let textIndex = 0
      for (const segment of segments) {
        const ordinalKey = segmentKeyFor(identity, segment, counters)
        const sourceParts = segment.kind === 'text' ? groups[textIndex++] : undefined
        const key = sourceParts
          ? representativePart(
              textRefs,
              sourceParts.map((part) => part.key)
            ).repPartKey
          : ordinalKey
        const existing = oldByKey.get(key)
        atoms.push(
          existing?.segment === segment
            ? existing
            : {
                kind: 'segment',
                key,
                messageId: identity,
                segment,
                ...(sourceParts ? { sourceParts } : {})
              }
        )
      }
      chunk = []
      offset++
    }
    for (const [index, part] of parts.entries()) {
      if (part.type === 'response_boundary') {
        flush(index)
        chunkStart = index + 1
        atoms.push({
          kind: 'boundary',
          key: partBlockKey(identity, 'boundary', boundarySeq++),
          boundary: part.boundary
        })
      } else if (part.type !== 'tool_result') chunk.push(part)
    }
    flush(parts.length)
    const parsed = { atoms, results }
    cache.set(message, parsed)
    previous.set(identity, { atoms, caches })
    return parsed
  }
  return (messages, toolResults) => {
    const parsed = messages.map(parse)
    const identities = new Set(messages.map((message, index) => message.id ?? `m:${index}`))
    for (const identity of previous.keys()) {
      if (!identities.has(identity)) previous.delete(identity)
    }
    const results = new Map<string, NonNullable<ToolCall['result']>>()
    for (const message of parsed)
      for (const [id, result] of message.results) results.set(id, result)
    if (toolResults) for (const [id, result] of toolResults) results.set(id, result)
    // Writer가 telemetry 뒤 별도 메시지에 기록한 결과도 원래 도구 ID에 결합한다.
    // 기존 메시지를 재파싱하지 않으며 동일 결과의 view/children identity를 유지한다.
    function join(atom: Atom): Atom {
      if (atom.kind !== 'segment' || (atom.segment.kind !== 'tools' && atom.segment.kind !== 'ask'))
        return atom
      const prior = joined.get(atom) ?? atom
      const segment = prior.segment
      if (segment.kind !== 'tools' && segment.kind !== 'ask') return atom
      const calls = segment.kind === 'tools' ? segment.calls : [segment.call]
      const next = calls.map((call) => {
        const result = results.get(call.toolUseId)
        if (result === call.result) return call
        if (result) return { ...call, result }
        const copy = { ...call }
        delete copy.result
        return copy
      })
      if (next.every((call, index) => call === calls[index])) return prior
      const node: SegmentNode = {
        ...atom,
        segment:
          segment.kind === 'tools' ? { kind: 'tools', calls: next } : { kind: 'ask', call: next[0] }
      }
      joined.set(atom, node)
      return node
    }
    const atoms = parsed.flatMap((message) => message.atoms.map(join))
    if (!atoms.some((atom) => atom.kind === 'boundary')) return null
    const output: WorkActivityNode[] = []
    let active: { id: string; items: SegmentNode[] } | undefined
    function finish(outcome: 'ended' | 'aborted' | 'failed' | 'unknown'): void {
      if (!active) return
      const { id, items } = active
      let activity: SegmentNode[] = []
      let trailingText: SegmentNode[] = []
      function flushActivity(): void {
        if (!activity.length) return
        const toolCount = activity.reduce(
          (count, item) => count + (item.segment.kind === 'tools' ? item.segment.calls.length : 0),
          0
        )
        const firstTool = firstToolRunIdInActivity(activity)
        const key = firstTool
          ? activityBlockKey(activity[0].messageId, firstTool)
          : activityBlockKey(activity[0].messageId, id)
        output.push({
          kind: 'activity',
          key,
          items: activity,
          toolCount,
          noteCount: activity.filter((item) => item.segment.kind === 'text').length
        })
        activity = []
      }
      items.forEach((item) => {
        if (item.segment.kind === 'tools') {
          // Text becomes a note only after another tool confirms both sides of its position.
          activity.push(...trailingText, item)
          trailingText = []
        } else if (item.segment.kind === 'text' && activity.length) trailingText.push(item)
        else {
          flushActivity()
          output.push(...trailingText)
          trailingText = []
          output.push(item)
        }
      })
      flushActivity()
      // The final text, including an interrupted partial answer, stays outside the disclosure.
      output.push(...trailingText)
      output.push({ kind: 'status', key: `status:${id}`, outcome })
      active = undefined
    }
    for (const atom of atoms) {
      if (atom.kind === 'boundary') {
        if (atom.boundary.phase === 'begin') {
          if (active?.id === atom.boundary.id) continue
          finish('unknown')
          active = { id: atom.boundary.id, items: [] }
        } else if (active?.id === atom.boundary.id) finish(atom.boundary.outcome)
      } else if (active) active.items.push(atom)
      else output.push(atom)
    }
    finish('unknown')
    return output
  }
}
