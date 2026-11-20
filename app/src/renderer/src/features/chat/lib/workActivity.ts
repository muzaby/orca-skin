import type { MarkdownSourcePart } from '../../../shared/ui/markdown/sourceParts'
import type { AppMessagePart } from '../../../../../shared/ipc'
import type { ResponseBoundary } from '../../../../../shared/response-boundary'
import type { Message, ToolCall } from '../reducer/chatReducer'
import { resultMap, type MessageSegment } from './parts'
import type { OrderedToolParts } from './transcript/orderedToolParts'
import { createSegmentCache, previousMessageEditOffset } from './segmentCache'
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
  entriesFor?: (message: Message, partsFrom?: number) => readonly PartKeyEntry[],
  editFrom: (message: Message, previous: Message) => number | undefined = previousMessageEditOffset
): (
  messages: readonly Message[],
  toolResults?: WorkToolResultsMap,
  toolInputs?: Pick<OrderedToolParts<Record<string, unknown>>, 'firstOwner' | 'latest'>
) => WorkActivityNode[] | null {
  type Parsed = { atoms: Atom[]; results: ReturnType<typeof resultMap> }
  const cache = new WeakMap<Message, Parsed>()
  type Chunk = {
    start: number
    end: number
    parts: AppMessagePart[]
    positions: number[]
    boundary?: ResponseBoundary
  }
  type IndexedResult = { index: number; id: string; value: NonNullable<ToolCall['result']> }
  const previous = new Map<
    string,
    {
      message: Message
      parts: AppMessagePart[]
      atoms: Atom[]
      caches: Map<number, ReturnType<typeof createSegmentCache>>
      chunks: Chunk[]
      contributions: IndexedResult[]
    }
  >()
  const joined = new WeakMap<SegmentNode, SegmentNode>()
  const activityRows = new WeakMap<SegmentNode, Extract<WorkActivityNode, { kind: 'activity' }>>()
  const statusRows = new WeakMap<ResponseBoundary, Extract<WorkActivityNode, { kind: 'status' }>>()
  const resultViews = new WeakMap<AppMessagePart, NonNullable<ToolCall['result']>>()
  function parse(message: Message, index: number): Parsed {
    const cached = cache.get(message)
    if (cached) return cached
    const parts = message.parts
    const identity = message.id ?? `m:${index}`
    const prior = previous.get(identity)
    const edit = prior && editFrom(message, prior.message)
    let from = edit ?? 0
    if (prior && edit === undefined) {
      while (from < prior.parts.length && from < parts.length && prior.parts[from] === parts[from])
        from++
    }
    const chunks: Chunk[] = []
    let frame: Chunk = { start: 0, end: 0, parts: [], positions: [] }
    if (from && prior) {
      for (const original of prior.chunks) {
        if (original.boundary && original.end < from) {
          chunks.push(original)
          frame = { start: original.end + 1, end: original.end + 1, parts: [], positions: [] }
          continue
        }
        let kept = original.positions.length
        while (kept && original.positions[kept - 1] >= from) kept--
        frame = {
          start: original.start,
          end: from,
          parts: original.parts.slice(0, kept),
          positions: original.positions.slice(0, kept)
        }
        break
      }
    }
    const resumeChunk = chunks.length
    const resumeParts = frame.parts.length
    const contributions = prior?.contributions.filter((item) => item.index < from) ?? []
    for (let i = from; i < parts.length; i++) {
      const part = parts[i]
      if (part.type === 'tool_result') {
        const value = resultViews.get(part) ?? resultMap([part]).get(part.toolRunId)
        if (value) {
          resultViews.set(part, value)
          contributions.push({ index: i, id: part.toolRunId, value })
        }
      } else if (part.type === 'response_boundary') {
        chunks.push({ ...frame, end: i, boundary: part.boundary })
        frame = { start: i + 1, end: i + 1, parts: [], positions: [] }
      } else {
        frame.parts.push(part)
        frame.positions.push(i)
      }
    }
    chunks.push({ ...frame, end: parts.length })
    const results = new Map(contributions.map(({ id, value }) => [id, value]))
    const atoms: Atom[] = []
    let offset = 0
    const entries = entriesFor?.(message, from) ?? []
    let entryCursor = 0
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
    function flush(section: Chunk): void {
      const chunk = section.parts
      const chunkStart = section.start
      const chunkEnd = section.end
      const segmentCache = prior?.caches.get(offset) ?? createSegmentCache()
      caches.set(offset, segmentCache)
      const segments = segmentCache.segmentsFor(
        { id: message.id, role: message.role, createdAt: message.createdAt, parts: chunk },
        offset < resumeChunk ? chunk.length : offset === resumeChunk ? resumeParts : 0,
        results
      )
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
      offset++
    }
    for (const section of chunks) {
      flush(section)
      if (section.boundary)
        atoms.push({
          kind: 'boundary',
          key: partBlockKey(identity, 'boundary', boundarySeq++),
          boundary: section.boundary
        })
    }
    const parsed = { atoms, results }
    cache.set(message, parsed)
    previous.set(identity, { message, parts, atoms, caches, chunks, contributions })
    return parsed
  }
  return (messages, toolResults, toolInputs) => {
    const parsed = messages.map(parse)
    const identities = new Set(messages.map((message, index) => message.id ?? `m:${index}`))
    for (const identity of previous.keys()) {
      if (!identities.has(identity)) previous.delete(identity)
    }
    const results = new Map<string, NonNullable<ToolCall['result']>>()
    for (const message of parsed)
      for (const [id, result] of message.results) results.set(id, result)
    // Writer가 telemetry 뒤 별도 메시지에 기록한 결과도 원래 도구 ID에 결합한다.
    // 기존 메시지를 재파싱하지 않으며 동일 결과의 view/children identity를 유지한다.
    const seenCalls = new Set<string>()
    function join(atom: Atom): Atom | undefined {
      if (atom.kind !== 'segment' || (atom.segment.kind !== 'tools' && atom.segment.kind !== 'ask'))
        return atom
      const prior = joined.get(atom) ?? atom
      const source = atom.segment
      const segment = prior.segment
      if (segment.kind !== 'tools' && segment.kind !== 'ask') return atom
      const priorCalls = segment.kind === 'tools' ? segment.calls : [segment.call]
      const calls = source.kind === 'tools' ? source.calls : [source.call]
      const next: ToolCall[] = []
      for (const call of calls) {
        if (toolInputs) {
          if (
            toolInputs.firstOwner(call.toolUseId) !== atom.messageId ||
            seenCalls.has(call.toolUseId)
          )
            continue
          seenCalls.add(call.toolUseId)
        }
        const retained = priorCalls[next.length]
        const current = retained?.toolUseId === call.toolUseId ? retained : call
        const result = toolResults?.get(call.toolUseId) ?? results.get(call.toolUseId)
        const input = toolInputs?.latest(call.toolUseId) ?? call.input
        if (result === current.result && input === current.input) next.push(current)
        else {
          const updated = { ...call, input }
          if (result) updated.result = result
          else delete updated.result
          next.push(updated)
        }
      }
      if (next.length === 0) return undefined
      if (next.length === priorCalls.length && next.every((call, i) => call === priorCalls[i]))
        return prior
      const node: SegmentNode = {
        ...atom,
        key: source.kind === 'tools' ? toolBlockKey(atom.messageId, next[0].toolUseId) : atom.key,
        segment:
          source.kind === 'tools' ? { kind: 'tools', calls: next } : { kind: 'ask', call: next[0] }
      }
      joined.set(atom, node)
      return node
    }
    const atoms: Atom[] = []
    for (const message of parsed) {
      for (const atom of message.atoms) {
        const node = join(atom)
        if (node) atoms.push(node)
      }
    }
    if (!atoms.some((atom) => atom.kind === 'boundary')) return null
    const output: WorkActivityNode[] = []
    let active: { id: string; start: ResponseBoundary; items: SegmentNode[] } | undefined
    function finish(outcome: 'ended' | 'aborted' | 'failed' | 'unknown'): void {
      if (!active) return
      const { id, items, start } = active
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
        const previous = activityRows.get(activity[0])
        if (
          previous?.key === key &&
          previous.items.length === activity.length &&
          previous.items.every((item, i) => item === activity[i])
        ) {
          output.push(previous)
          activity = []
          return
        }
        const row = {
          kind: 'activity' as const,
          key,
          items: activity,
          toolCount,
          noteCount: activity.filter((item) => item.segment.kind === 'text').length
        }
        activityRows.set(activity[0], row)
        output.push(row)
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
      const previous = statusRows.get(start)
      if (previous?.outcome === outcome) output.push(previous)
      else {
        const row = { kind: 'status' as const, key: `status:${id}`, outcome }
        statusRows.set(start, row)
        output.push(row)
      }
      active = undefined
    }
    for (const atom of atoms) {
      if (atom.kind === 'boundary') {
        if (atom.boundary.phase === 'begin') {
          if (active?.id === atom.boundary.id) continue
          finish('unknown')
          active = { id: atom.boundary.id, start: atom.boundary, items: [] }
        } else if (active?.id === atom.boundary.id) finish(atom.boundary.outcome)
      } else if (active) active.items.push(atom)
      else output.push(atom)
    }
    finish('unknown')
    return output
  }
}
