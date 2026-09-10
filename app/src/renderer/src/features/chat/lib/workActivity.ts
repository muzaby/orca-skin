import type { AppMessagePart } from '../../../../../shared/ipc'
import type { ResponseBoundary } from '../../../../../shared/response-boundary'
import type { Message, ToolCall } from '../reducer/chatReducer'
import { messageSegments, reconcileSegments, resultMap, type MessageSegment } from './parts'
import type { WorkToolResults } from './workToolResults'

type SegmentNode = { kind: 'segment'; key: string; segment: MessageSegment }
type BoundaryNode = { kind: 'boundary'; key: string; boundary: ResponseBoundary }
type Atom = SegmentNode | BoundaryNode
export type WorkActivityNode =
  | SegmentNode
  | {
      kind: 'activity'
      key: string
      items: SegmentNode[]
      toolCount: number
    }
  | { kind: 'status'; key: string; outcome: 'ended' | 'aborted' | 'failed' | 'unknown' }

// 턴 인스턴스 소유 캐시. 완료 메시지의 parts는 재해석하지 않고 변경 메시지만 투영한다.
// 원문/도구 payload는 복제하지 않는다. 캐시 수명은 transcript 턴의 수명과 같다.
export function createWorkProjector(): (
  messages: readonly Message[],
  toolResults?: WorkToolResults
) => WorkActivityNode[] | null {
  type Parsed = { atoms: Atom[]; results: ReturnType<typeof resultMap> }
  const cache = new WeakMap<Message, Parsed>()
  const previous = new Map<number, Atom[]>()
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
    const old = previous.get(index) ?? []
    const oldByChunk = new Map<string, SegmentNode[]>()
    for (const node of old) {
      if (node.kind !== 'segment') continue
      const key = node.key.slice(0, node.key.lastIndexOf(':') + 1)
      const group = oldByChunk.get(key)
      if (group) group.push(node)
      else oldByChunk.set(key, [node])
    }
    function flush(): void {
      const prefix = `${index}:${offset}:`
      const oldSegments = oldByChunk.get(prefix) ?? []
      const segments = reconcileSegments(
        oldSegments.map((node) => node.segment),
        messageSegments(chunk, results)
      )
      segments.forEach((segment, position) => {
        const prior = oldSegments[position]
        atoms.push(
          prior?.segment === segment
            ? prior
            : { kind: 'segment', key: `${prefix}${position}`, segment }
        )
      })
      chunk = []
      offset++
    }
    for (const part of parts) {
      if (part.type === 'response_boundary') {
        flush()
        atoms.push({
          kind: 'boundary',
          key: `${index}:boundary:${offset}`,
          boundary: part.boundary
        })
      } else if (part.type !== 'tool_result') chunk.push(part)
    }
    flush()
    const parsed = { atoms, results }
    cache.set(message, parsed)
    previous.set(index, atoms)
    return parsed
  }
  return (messages, toolResults) => {
    const parsed = messages.map(parse)
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
        return !result || result === call.result ? call : { ...call, result }
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
      function flushActivity(): void {
        if (!activity.length) return
        const toolCount = activity.reduce(
          (count, item) => count + (item.segment.kind === 'tools' ? item.segment.calls.length : 0),
          0
        )
        output.push({
          kind: 'activity',
          key: `activity:${id}:${activity[0].key}`,
          items: activity,
          toolCount
        })
        activity = []
      }
      items.forEach((item) => {
        if (item.segment.kind === 'tools') activity.push(item)
        else {
          flushActivity()
          output.push(item)
        }
      })
      flushActivity()
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
