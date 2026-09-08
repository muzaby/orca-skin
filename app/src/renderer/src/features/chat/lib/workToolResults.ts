import type { AppMessagePart } from '../../../../../shared/ipc'
import type { Message, ToolCall } from '../reducer/chatReducer'
import { resultMap } from './parts'
import type { Exchange } from './turns'

export type WorkToolResults = ReadonlyMap<string, NonNullable<ToolCall['result']>>

export function createWorkToolResultSelector(): (
  exchanges: readonly Exchange[]
) => ReadonlyMap<number, WorkToolResults> {
  type Result = NonNullable<ToolCall['result']>
  type Parsed = { calls: Set<string>; results: Map<string, Result> }
  const messages = new WeakMap<Message, Parsed>()
  const parts = new WeakMap<Extract<AppMessagePart, { type: 'tool_result' }>, Result>()
  const empty: WorkToolResults = new Map()
  let previous: ReadonlyMap<number, WorkToolResults> = new Map()

  function parse(message: Message): Parsed {
    const cached = messages.get(message)
    if (cached) return cached
    const parsed: Parsed = { calls: new Set(), results: new Map() }
    for (const part of message.parts) {
      if (part.type === 'tool_call') parsed.calls.add(part.toolRunId)
      else if (part.type === 'tool_result') {
        let result = parts.get(part)
        if (!result) {
          // 기존 결과 변환을 재사용한다. 동일 불변 part의 wrapper도 한 번만 만든다.
          result = resultMap([part]).get(part.toolRunId)
          if (result) parts.set(part, result)
        }
        if (result) parsed.results.set(part.toolRunId, result)
      }
    }
    messages.set(message, parsed)
    return parsed
  }

  return (exchanges) => {
    const latest = new Map<string, Result>()
    const owners = new Map<number, Set<string>>()
    for (const exchange of exchanges) {
      const calls = new Set<string>()
      for (const turn of exchange.turns) {
        for (const message of turn.messages) {
          const parsed = parse(message)
          for (const id of parsed.calls) calls.add(id)
          for (const [id, result] of parsed.results) latest.set(id, result)
        }
      }
      owners.set(exchange.startIndex, calls)
    }

    const next = new Map<number, WorkToolResults>()
    for (const [index, calls] of owners) {
      const relevant = new Map<string, Result>()
      for (const id of calls) {
        const result = latest.get(id)
        if (result) relevant.set(id, result)
      }
      const old = previous.get(index)
      const unchanged =
        old?.size === relevant.size && [...relevant].every(([id, result]) => old.get(id) === result)
      next.set(index, unchanged ? old : relevant.size === 0 ? empty : relevant)
    }
    if (
      previous.size === next.size &&
      [...next].every(([index, results]) => previous.get(index) === results)
    )
      return previous
    previous = next
    return next
  }
}
