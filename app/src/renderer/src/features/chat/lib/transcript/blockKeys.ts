/**
 * Stable, position-independent block & part key rules (EP-7 · D-054 · D-067 · D-070 · D-071 · D-084 · D-085).
 */
import type { AppMessagePart } from '../../../../../../shared/ipc'
import type { MarkdownSourcePart } from '../../../../shared/ui/markdown/sourceParts'
import type { Message } from '../../reducer/chatReducer'
import { hasSegmentText } from '../parts'

export function userBlockKey(messageId: string): string {
  return `${messageId}:user`
}

export function partBlockKey(messageId: string, kind: string, seq: number): string {
  return `${messageId}:${kind}:${seq}`
}

export function toolBlockKey(messageId: string, toolRunId: string): string {
  return `${messageId}:tool:${toolRunId}`
}

export function activityBlockKey(messageId: string, toolRunId: string): string {
  return `${messageId}:activity:${toolRunId}`
}

export function turnMetaKey(firstAssistantId: string): string {
  return `${firstAssistantId}:meta`
}

export function turnArtifactsKey(firstAssistantId: string): string {
  return `${firstAssistantId}:artifacts`
}

export function liveBlockKey(sessionKey: string): string {
  return `live:${sessionKey}`
}

export function assertUniqueBlockKeys(blocks: readonly { readonly key: string }[]): void {
  const seen = new Set<string>()
  for (const block of blocks) {
    if (seen.has(block.key)) {
      throw new Error(`Duplicate transcript block key: ${block.key}`)
    }
    seen.add(block.key)
  }
}

export function partKeyKind(part: AppMessagePart): string | null {
  if ('parentToolRunId' in part && part.parentToolRunId !== undefined) return null
  switch (part.type) {
    case 'text':
      return 'text'
    case 'reasoning':
      return 'reasoning'
    case 'tool_call':
      return 'tool'
    case 'compact_boundary':
      return 'compact'
    case 'fork_boundary':
      return 'fork'
    case 'error':
      return 'error'
    case 'subagent_notice':
      return 'notice'
    case 'response_boundary':
      return 'boundary'
    case 'attachment':
      return 'attachment'
    case 'artifact':
      return 'artifact'
    case 'tool_result':
      return null
    default:
      return null
  }
}

function partContentSignature(part: AppMessagePart): string | null {
  switch (part.type) {
    case 'text':
      return `text:${part.text}`
    case 'reasoning':
      return `reasoning:${part.text}`
    case 'fork_boundary':
      return 'fork'
    case 'compact_boundary':
      return `compact:${part.trigger ?? ''}:${part.preTokens ?? ''}`
    case 'error':
      if (part.failure) return `failure:${part.failure.failureId}`
      return `error:${typeof part.error === 'string' ? part.error : JSON.stringify(part.error ?? '')}`
    case 'subagent_notice':
      return `notice:${part.toolRunId}`
    case 'response_boundary':
      return `boundary:${part.boundary.id}:${part.boundary.phase}`
    case 'artifact':
      return `artifact:${part.artifact.publicationId}`
    case 'attachment':
      return `attachment:${JSON.stringify(part.attachments.map((a) => a.id))}`
    default:
      return null
  }
}

export interface PartKeyEntry {
  readonly partIndex: number
  readonly kind: string
  readonly key: string
  readonly signature: string | null
  readonly toolRunId?: string
}

/** The segment renderer concatenates consecutive text contributions before Markdown parsing. */
export function textPartGroups(entries: readonly PartKeyEntry[]): MarkdownSourcePart[][] {
  const groups: MarkdownSourcePart[][] = []
  let group: MarkdownSourcePart[] = []
  let start = 0
  for (const entry of entries) {
    if (entry.kind === 'text') {
      const text = entry.signature?.slice('text:'.length) ?? ''
      if (text && (group.length > 0 || hasSegmentText(text))) {
        group.push({ key: entry.key, start })
        start += text.length
      }
    } else if (
      entry.kind !== 'boundary' &&
      entry.kind !== 'artifact' &&
      entry.kind !== 'attachment' &&
      !(entry.kind === 'reasoning' && !entry.signature?.slice('reasoning:'.length).trim())
    ) {
      if (group.length) groups.push(group)
      group = []
      start = 0
    }
  }
  if (group.length) groups.push(group)
  return groups
}

export class PartKeyTracker {
  private readonly maxSeq = new Map<string, number>()

  private seqKey(messageId: string, kind: string): string {
    return `${messageId}\0${kind}`
  }

  allocate(messageId: string, kind: string): string {
    const sk = this.seqKey(messageId, kind)
    const next = (this.maxSeq.get(sk) ?? -1) + 1
    this.maxSeq.set(sk, next)
    return partBlockKey(messageId, kind, next)
  }

  peek(messageId: string, kind: string): string {
    const sk = this.seqKey(messageId, kind)
    const next = (this.maxSeq.get(sk) ?? -1) + 1
    return partBlockKey(messageId, kind, next)
  }

  observe(messageId: string, kind: string, key: string): void {
    const prefix = `${messageId}:${kind}:`
    if (!key.startsWith(prefix)) return
    const num = Number(key.slice(prefix.length))
    if (!Number.isInteger(num) || num < 0) return
    const sk = this.seqKey(messageId, kind)
    const prev = this.maxSeq.get(sk) ?? -1
    if (num > prev) this.maxSeq.set(sk, num)
  }
}

/**
 * Peek the next part key for a live streaming message without consuming the sequence number (D-084).
 * When the live message commits, allocating the part yields the exact same key.
 */
export function nextPartKey(
  tracker: PartKeyTracker,
  messageKey: string,
  kind: 'text' | 'reasoning' = 'text'
): string {
  return tracker.peek(messageKey, kind)
}

/**
 * Carry part keys across a `reset` for a message with the same `id` (EP-7 ⑩ · D-085).
 * - `tool_call`: keyed stably by `toolRunId`.
 * - `user`: 1 block (`userBlockKey(id)`).
 * - `text`/`reasoning`/`compact`/`error`/etc.: matched by content signature within kind.
 *   Multiplicity rule (D-085): if a content signature appears >1 times in either prev or next,
 *   carry in document order ONLY when `prevCount === nextCount`; otherwise allocate fresh keys
 *   for the entire multiplicity group.
 */
export function carryPartKeys(
  tracker: PartKeyTracker,
  messageId: string,
  prevEntries: readonly PartKeyEntry[] | undefined,
  nextMessage: Message
): PartKeyEntry[] {
  const prevList = prevEntries ?? []
  const prevBySig = new Map<string, PartKeyEntry[]>()
  for (const entry of prevList) {
    if (entry.signature === null) continue
    const list = prevBySig.get(entry.signature)
    if (list) list.push(entry)
    else prevBySig.set(entry.signature, [entry])
  }

  const nextParts: { partIndex: number; part: AppMessagePart; kind: string; sig: string | null }[] =
    []
  const nextCountBySig = new Map<string, number>()

  for (let i = 0; i < nextMessage.parts.length; i++) {
    const part = nextMessage.parts[i]
    const kind = partKeyKind(part)
    if (!kind) continue
    const sig = part.type === 'tool_call' ? null : partContentSignature(part)
    nextParts.push({ partIndex: i, part, kind, sig })
    if (sig !== null) {
      nextCountBySig.set(sig, (nextCountBySig.get(sig) ?? 0) + 1)
    }
  }

  const consumedSigIndex = new Map<string, number>()
  const result: PartKeyEntry[] = []

  for (const item of nextParts) {
    if (item.part.type === 'tool_call') {
      const key = toolBlockKey(messageId, item.part.toolRunId)
      result.push({
        partIndex: item.partIndex,
        kind: 'tool',
        key,
        signature: null,
        toolRunId: item.part.toolRunId
      })
      continue
    }

    let key: string | undefined
    if (item.sig !== null) {
      const prevGroup = prevBySig.get(item.sig)
      const nextCount = nextCountBySig.get(item.sig) ?? 0
      if (prevGroup && prevGroup.length > 0) {
        const allowCarry =
          (prevGroup.length === 1 && nextCount === 1) ||
          (prevGroup.length > 1 && prevGroup.length === nextCount)
        if (allowCarry) {
          const cursor = consumedSigIndex.get(item.sig) ?? 0
          if (cursor < prevGroup.length) {
            key = prevGroup[cursor].key
            consumedSigIndex.set(item.sig, cursor + 1)
            tracker.observe(messageId, item.kind, key)
          }
        }
      }
    }

    if (key === undefined) {
      key = tracker.allocate(messageId, item.kind)
    }

    result.push({
      partIndex: item.partIndex,
      kind: item.kind,
      key,
      signature: item.sig
    })
  }

  return result
}

export interface MultiPartGroupRef {
  readonly key: string
  readonly repPartKey: string
  readonly partKeys: ReadonlySet<string>
}

/**
 * Determine the representative part key for a multi-part block (OpenCode segment or Work activity group)
 * (EP-7 ⑪ · D-085).
 * - If one or more previous groups have their representative part in `partKeys`, pick the FIRST one
 *   in document order (front group wins; back group's disclosure is discarded).
 * - Otherwise, pick `partKeys[0]`.
 */
export function representativePart(
  prevGroups: readonly MultiPartGroupRef[],
  partKeys: readonly string[]
): {
  repPartKey: string
  retainedGroupKey?: string
  inheritedFromKey?: string
  droppedGroupKeys: string[]
} {
  if (partKeys.length === 0) {
    throw new Error('representativePart requires at least one part key')
  }
  const keySet = new Set(partKeys)
  const matchedPrev: MultiPartGroupRef[] = []
  for (const group of prevGroups) {
    if (keySet.has(group.repPartKey)) {
      matchedPrev.push(group)
    }
  }
  if (matchedPrev.length > 0) {
    const winner = matchedPrev[0]
    const droppedGroupKeys = matchedPrev.slice(1).map((g) => g.key)
    return { repPartKey: winner.repPartKey, retainedGroupKey: winner.key, droppedGroupKeys }
  }

  // Split case (y13): no previous representative is inside this new group,
  // check if any part belonged to a previous group so the split-off side can inherit its disclosure.
  let inheritedFromKey: string | undefined
  for (const group of prevGroups) {
    for (const pk of partKeys) {
      if (group.partKeys.has(pk)) {
        inheritedFromKey = group.key
        break
      }
    }
    if (inheritedFromKey !== undefined) break
  }

  return { repPartKey: partKeys[0], inheritedFromKey, droppedGroupKeys: [] }
}
