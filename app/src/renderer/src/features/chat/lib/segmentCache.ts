import { nonExecutionEquals } from '../../../../../shared/tool-outcome'
import type { Message, ToolCall } from '../reducer/chatReducer'
import { extendSegment, segmentForPart, toolResultFromPart, type MessageSegment } from './parts'

type Result = NonNullable<ToolCall['result']>
type ResultMap = ReadonlyMap<string, Result>
interface Span {
  readonly start: number
  end: number
  segment: MessageSegment
}
interface IndexedResult {
  readonly index: number
  readonly id: string
  readonly result: Result
}

const edits = new WeakMap<Message, { prior: WeakRef<Message>; partsFrom: number }>()

export function rememberMessageEdit(message: Message, prior: Message, partsFrom: number): void {
  edits.set(message, { prior: new WeakRef(prior), partsFrom })
}

function sameResult(a: Result | undefined, b: Result | undefined): boolean {
  if (a === b) return true
  return (
    !!a &&
    !!b &&
    a.output === b.output &&
    a.isError === b.isError &&
    a.durationMs === b.durationMs &&
    a.parentToolRunId === b.parentToolRunId &&
    a.subagentMeta === b.subagentMeta &&
    a.structuredOutput === b.structuredOutput &&
    nonExecutionEquals(a.nonExecution, b.nonExecution)
  )
}

function updatedResult(call: ToolCall, result: Result | undefined): ToolCall {
  if (call.result === result) return call
  if (result) return { ...call, result }
  const next = { ...call }
  delete next.result
  return next
}

function editable(segment: MessageSegment): MessageSegment {
  if (segment.kind === 'reasoning') return { ...segment, items: segment.items.slice() }
  if (segment.kind === 'tools') return { ...segment, calls: segment.calls.slice() }
  return { ...segment }
}

function groupKind(kind: MessageSegment['kind']): boolean {
  return kind === 'text' || kind === 'tools' || kind === 'reasoning'
}

function eachCall(segment: MessageSegment, callback: (id: string) => void): void {
  if (segment.kind === 'ask') callback(segment.call.toolUseId)
  else if (segment.kind === 'tools') for (const call of segment.calls) callback(call.toolUseId)
}

export function createSegmentCache(): {
  segmentsFor(message: Message, partsFrom?: number, externalResults?: ResultMap): MessageSegment[]
} {
  let previous: Message | undefined
  let previousExternal: ResultMap | undefined
  let spans: Span[] = []
  let views: MessageSegment[] = []
  const byTool = new Map<string, Set<number>>()
  const indexed: IndexedResult[] = []
  const stacks = new Map<string, IndexedResult[]>()
  const results = new Map<string, Result>()

  function recordSpan(segment: MessageSegment, index: number, adding: boolean): void {
    eachCall(segment, (id) => {
      const indexes = byTool.get(id) ?? new Set<number>()
      if (adding) indexes.add(index)
      else indexes.delete(index)
      if (indexes.size > 0) byTool.set(id, indexes)
      else byTool.delete(id)
    })
  }

  return {
    segmentsFor(message, partsFrom, externalResults) {
      if (previous === message && previousExternal === externalResults) return views
      const parts = message.parts
      const edit = edits.get(message)
      let from = partsFrom
      if (from === undefined) {
        if (previous && edit?.prior.deref() === previous) from = edit.partsFrom
        else {
          from = 0
          const prior = previous?.parts
          while (
            prior &&
            from < prior.length &&
            from < parts.length &&
            prior[from] === parts[from]
          ) {
            from++
          }
        }
      }
      if (!previous) from = 0
      from = Math.min(from, parts.length, previous?.parts.length ?? 0)

      const changed = new Set<string>()
      while (indexed.length > 0 && indexed[indexed.length - 1].index >= from) {
        const old = indexed.pop()!
        const stack = stacks.get(old.id)!
        stack.pop()
        if (stack.length === 0) stacks.delete(old.id)
        changed.add(old.id)
      }
      const suffix = parts.slice(from)
      suffix.forEach((part, index) => {
        if (part.type === 'tool_call' && externalResults) changed.add(part.toolRunId)
        if (part.type !== 'tool_result') return
        const item = { index: from + index, id: part.toolRunId, result: toolResultFromPart(part) }
        indexed.push(item)
        const stack = stacks.get(part.toolRunId) ?? []
        stack.push(item)
        stacks.set(part.toolRunId, stack)
        changed.add(part.toolRunId)
      })
      if (previousExternal !== externalResults) {
        for (const id of byTool.keys()) changed.add(id)
      }
      const changedTools = new Set<number>()
      for (const id of changed) {
        const result = externalResults?.get(id) ?? stacks.get(id)?.at(-1)?.result
        if (sameResult(results.get(id), result)) continue
        if (result) results.set(id, result)
        else results.delete(id)
        for (const span of byTool.get(id) ?? []) changedTools.add(span)
      }

      const detached = new Set<string>()
      let retained = spans.length
      while (retained > 0 && spans[retained - 1].end > from) retained--
      const rebuildFrom = Math.min(spans[retained]?.start ?? from, from)
      for (let index = retained; index < spans.length; index++) {
        eachCall(spans[index].segment, (id) => detached.add(id))
        recordSpan(spans[index].segment, index, false)
      }
      let next = spans.slice(0, retained)
      for (const index of changedTools) {
        if (index >= retained) continue
        const span = next[index]
        const segment = span.segment
        const updated =
          segment.kind === 'ask'
            ? { ...segment, call: updatedResult(segment.call, results.get(segment.call.toolUseId)) }
            : segment.kind === 'tools'
              ? {
                  ...segment,
                  calls: segment.calls.map((call) =>
                    updatedResult(call, results.get(call.toolUseId))
                  )
                }
              : segment
        next[index] = { ...span, segment: updated }
      }
      let editableTail = false
      const rebuild = rebuildFrom < from ? [...parts.slice(rebuildFrom, from), ...suffix] : suffix
      for (let index = 0; index < rebuild.length; index++) {
        const segment = segmentForPart(rebuild[index], results)
        if (!segment) continue
        const partIndex = rebuildFrom + index
        let tail = next.at(-1)
        if (tail && groupKind(segment.kind) && tail.segment.kind === segment.kind) {
          if (!editableTail) {
            const last = next.length - 1
            recordSpan(tail.segment, last, false)
            next[last] = tail = { ...tail, segment: editable(tail.segment) }
          }
          extendSegment(tail.segment, segment)
          tail.end = partIndex + 1
        } else {
          if (editableTail && tail) recordSpan(tail.segment, next.length - 1, true)
          next.push({ start: partIndex, end: partIndex + 1, segment })
        }
        editableTail = true
      }
      if (editableTail) recordSpan(next[next.length - 1].segment, next.length - 1, true)
      for (const id of detached) {
        if (!byTool.has(id) && !stacks.has(id)) results.delete(id)
      }
      if (next.length !== spans.length || next.some((span, index) => span !== spans[index])) {
        views = next.map(({ segment }) => segment)
      } else {
        next = spans
      }
      spans = next
      previous = message
      previousExternal = externalResults
      return views
    }
  }
}
