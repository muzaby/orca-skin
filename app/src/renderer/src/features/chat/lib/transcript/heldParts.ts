import type { AppMessagePart } from '../../../../../../shared/ipc'
import type { Message } from '../../reducer/chatReducer'
import { partMergeKey } from './mergeKey'

type ArtifactPart = Extract<AppMessagePart, { type: 'artifact' }>

interface HeldPart {
  readonly part: AppMessagePart
  readonly sequence: number
}

type HeldMap = ReadonlyMap<string, readonly HeldPart[]>

export interface HeldParts {
  readonly heldPatches: HeldMap
  readonly heldOutputs: HeldMap
  readonly heldSequence: number
}

type HeldKind = 'heldPatches' | 'heldOutputs'
export type TranscriptDiagnostic = (
  event: 'prependRejected' | 'heldPatchOrphaned',
  count: number
) => void

const EMPTY_HELD: HeldMap = new Map()

export function emptyHeldParts(): HeldParts {
  return { heldPatches: EMPTY_HELD, heldOutputs: EMPTY_HELD, heldSequence: 0 }
}

export function outputOwnerReference(toolRunId?: string, responseId?: string): string | undefined {
  if (toolRunId !== undefined) return `tool:${toolRunId}`
  if (responseId !== undefined) return `response:${responseId}`
  return undefined
}

export function holdPart(
  state: HeldParts,
  kind: HeldKind,
  owner: string,
  part: AppMessagePart
): HeldParts {
  const previous = state[kind].get(owner) ?? []
  if (
    part.type === 'subagent_notice' &&
    previous.some(
      ({ part: prior }) => prior.type === 'subagent_notice' && prior.toolRunId === part.toolRunId
    )
  ) {
    return state
  }
  const key = partMergeKey(part)
  const index =
    key === undefined ? -1 : previous.findIndex(({ part }) => partMergeKey(part) === key)
  if (index >= 0 && part.type === 'artifact') return state
  const next = previous.slice()
  const heldSequence = index >= 0 ? state.heldSequence : state.heldSequence + 1
  if (index >= 0) next[index] = { part, sequence: previous[index].sequence }
  else next.push({ part, sequence: heldSequence })
  return {
    heldPatches: state.heldPatches,
    heldOutputs: state.heldOutputs,
    heldSequence,
    [kind]: new Map(state[kind]).set(owner, next)
  }
}

function artifactExists(messages: readonly Message[], at: number, part: ArtifactPart): boolean {
  const key = partMergeKey(part)
  let first = at
  while (first > 0 && messages[first - 1].role === 'assistant') first--
  for (
    let index = first;
    index < messages.length && messages[index].role === 'assistant';
    index++
  ) {
    if (messages[index].parts.some((existing) => partMergeKey(existing) === key)) return true
  }
  return false
}

export function mergeHeldParts(
  state: HeldParts,
  messages: Message[],
  count = messages.length,
  hasRetainedNotice?: (toolRunId: string) => boolean
): HeldParts & { messages: Message[] } {
  if (state.heldPatches.size === 0 && state.heldOutputs.size === 0)
    return {
      messages,
      heldPatches: state.heldPatches,
      heldOutputs: state.heldOutputs,
      heldSequence: state.heldSequence
    }
  const heldPatches = new Map(state.heldPatches)
  const heldOutputs = new Map(state.heldOutputs)
  const updates: Array<HeldPart & { index: number }> = []
  const notices = new Set<string>()
  for (let index = 0; index < count; index++) {
    const message = messages[index]
    if (message.role !== 'assistant') continue
    const pending: HeldPart[] = []
    if (message.id !== undefined) {
      for (const patch of heldPatches.get(message.id) ?? []) pending.push(patch)
      heldPatches.delete(message.id)
    }
    for (const part of message.parts) {
      if (part.type === 'subagent_notice') notices.add(part.toolRunId)
      const owner =
        part.type === 'tool_call'
          ? outputOwnerReference(part.toolRunId)
          : part.type === 'response_boundary' && part.boundary.phase === 'begin'
            ? outputOwnerReference(undefined, part.boundary.id)
            : undefined
      if (owner === undefined || !heldOutputs.has(owner)) continue
      for (const output of heldOutputs.get(owner)!) pending.push(output)
      heldOutputs.delete(owner)
    }
    for (const entry of pending) updates.push({ ...entry, index })
  }

  // One publication may arrive through calls or responses on different messages of the same turn.
  // Replay their arrival order so the first reference has the same owner as in the live transcript.
  let merged = messages
  for (const { index, part } of updates.sort((a, b) => a.sequence - b.sequence)) {
    if (part.type === 'artifact' && artifactExists(merged, index, part)) continue
    if (part.type === 'subagent_notice') {
      if (notices.has(part.toolRunId) || hasRetainedNotice?.(part.toolRunId)) continue
      notices.add(part.toolRunId)
    }
    if (merged === messages) merged = messages.slice()
    if (merged[index] === messages[index]) {
      merged[index] = { ...messages[index], parts: messages[index].parts.slice() }
    }
    const parts = merged[index].parts
    const key = partMergeKey(part)
    const slot =
      key === undefined || part.type === 'artifact'
        ? -1
        : parts.findIndex((existing) => partMergeKey(existing) === key)
    if (slot < 0) parts.push(part)
    else parts[slot] = part
  }
  return { messages: merged, heldPatches, heldOutputs, heldSequence: state.heldSequence }
}

export function finishHeldParts(state: HeldParts, diagnostic?: TranscriptDiagnostic): HeldParts {
  let count = 0
  for (const pending of state.heldPatches.values()) count += pending.length
  for (const pending of state.heldOutputs.values()) count += pending.length
  if (count > 0) diagnostic?.('heldPatchOrphaned', count)
  return emptyHeldParts()
}
