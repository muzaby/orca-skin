import type { AppMessagePart } from '../../../../../../shared/ipc'
import { rendererMessageId, userMessageId } from '../../../../../../shared/message-id'
import type { Message } from '../../reducer/chatReducer'
import {
  changesSince,
  foldChanges,
  type TranscriptChanges,
  type TranscriptRevision
} from './changeLog'
import { partMergeKey } from './mergeKey'

interface Transcript {
  readonly messages: readonly Message[]
  readonly transcriptChanges: TranscriptChanges
}

interface Contribution {
  readonly ownership?: string
  readonly merge?: string
}

const fallbackIds = new WeakMap<Message, string>()
let fallbackSequence = 0

function idOf(message: Message): string {
  if (message.id !== undefined) return message.id
  if (message.role === 'user' && message.clientId !== undefined) {
    return userMessageId([message.clientId])
  }
  let id = fallbackIds.get(message)
  if (id === undefined) {
    id = rendererMessageId(`legacy-${++fallbackSequence}`)
    fallbackIds.set(message, id)
  }
  return id
}

function contribution(part: AppMessagePart): Contribution | undefined {
  const ownership =
    part.type === 'tool_call'
      ? `tool:${part.toolRunId}`
      : part.type === 'response_boundary' && part.boundary.phase === 'begin'
        ? `response:${part.boundary.id}`
        : part.type === 'subagent_notice'
          ? `notice:${part.toolRunId}`
          : undefined
  const merge = partMergeKey(part)
  return ownership === undefined && merge === undefined ? undefined : { ownership, merge }
}

class MessageOrder {
  private readonly ranks = new Map<string, number>()
  private readonly contributions = new Map<string, Map<number, Contribution>>()
  private readonly ownership = new Map<string, Map<string, number>>()
  private readonly merges = new Map<string, Map<string, Set<number>>>()
  private start = 0
  private end = 0
  private dirty = false
  private indexed = false
  private cursor?: TranscriptRevision
  private previous?: WeakRef<readonly Message[]>

  advance(state: Transcript): void {
    const { transcriptChanges, messages } = state
    const previous = this.previous?.deref()
    if (previous === messages && this.cursor?.revision === transcriptChanges.revision) return
    const changes = changesSince(transcriptChanges, this.cursor)
    if (
      changes === 'reset' ||
      changes.some((change) => change.kind === 'reset') ||
      changes.length === 0
    ) {
      this.rebuild(messages)
    } else {
      for (const change of changes) {
        switch (change.kind) {
          case 'append':
            for (const id of change.ids) this.ranks.set(id, this.end++)
            break
          case 'prepend':
            this.start -= change.ids.length
            change.ids.forEach((id, index) => this.ranks.set(id, this.start + index))
            break
          case 'remove':
            for (const id of change.ids) this.ranks.delete(id)
            this.dirty = true
            break
        }
      }
      if (this.indexed) {
        for (const [id, from] of foldChanges(changes)) {
          const position = this.messagePosition(id)
          this.replaceContributions(id, position < 0 ? undefined : messages[position], from)
        }
      }
    }
    this.cursor = { lineage: transcriptChanges.lineage, revision: transcriptChanges.revision }
    this.previous = new WeakRef(messages)
  }

  private rebuild(messages: readonly Message[]): void {
    this.start = 0
    this.end = 0
    this.dirty = false
    this.ranks.clear()
    this.contributions.clear()
    this.ownership.clear()
    this.merges.clear()
    for (const message of messages) {
      const id = idOf(message)
      this.ranks.set(id, this.end++)
      if (this.indexed) this.replaceContributions(id, message, 0)
    }
  }

  ensureContributions(messages: readonly Message[]): void {
    if (this.indexed) return
    this.indexed = true
    for (const message of messages) this.replaceContributions(idOf(message), message, 0)
  }

  messagePosition(id: string): number {
    if (!this.ranks.has(id)) return -1
    if (this.dirty) {
      const ordered = Array.from(this.ranks).sort((left, right) => left[1] - right[1])
      ordered.forEach(([key], index) => this.ranks.set(key, index))
      this.start = 0
      this.end = ordered.length
      this.dirty = false
    }
    return this.ranks.get(id)! - this.start
  }

  private owner(key: string): string | undefined {
    let owner: string | undefined
    let rank = Infinity
    for (const id of this.ownership.get(key)?.keys() ?? []) {
      const next = this.ranks.get(id)
      if (next !== undefined && next < rank) {
        owner = id
        rank = next
      }
    }
    return owner
  }

  toolCallOwner(id: string): string | undefined {
    return this.owner(`tool:${id}`)
  }

  responseOwner(id: string): string | undefined {
    return this.owner(`response:${id}`)
  }

  noticeOwner(id: string): string | undefined {
    return this.owner(`notice:${id}`)
  }

  partSlot(id: string, key: string): number | undefined {
    const slots = this.merges.get(id)?.get(key)
    if (!slots?.size) return undefined
    let first = Infinity
    for (const slot of slots) first = Math.min(first, slot)
    return first
  }

  private replaceContributions(id: string, message: Message | undefined, from: number): void {
    const prior = this.contributions.get(id) ?? new Map<number, Contribution>()
    const slots = this.merges.get(id) ?? new Map<string, Set<number>>()
    for (const [position, item] of prior) {
      if (message && position < from) continue
      this.updateOwner(item.ownership, id, -1)
      if (item.merge !== undefined) {
        const matches = slots.get(item.merge)!
        matches.delete(position)
        if (!matches.size) slots.delete(item.merge)
      }
      prior.delete(position)
    }
    if (message) {
      const parts = message.parts
      for (let index = from; index < parts.length; index++) {
        const item = contribution(parts[index])
        if (!item) continue
        prior.set(index, item)
        this.updateOwner(item.ownership, id, 1)
        if (item.merge !== undefined) {
          const matches = slots.get(item.merge) ?? new Set<number>()
          matches.add(index)
          slots.set(item.merge, matches)
        }
      }
    }
    if (prior.size) this.contributions.set(id, prior)
    else this.contributions.delete(id)
    if (slots.size) this.merges.set(id, slots)
    else this.merges.delete(id)
  }

  private updateOwner(key: string | undefined, id: string, delta: 1 | -1): void {
    if (key === undefined) return
    const owners = this.ownership.get(key) ?? new Map<string, number>()
    const count = (owners.get(id) ?? 0) + delta
    if (count > 0) owners.set(id, count)
    else owners.delete(id)
    if (owners.size) this.ownership.set(key, owners)
    else this.ownership.delete(key)
  }
}

const indexes = new WeakMap<object, MessageOrder>()

export function messageOrderFor(state: Transcript, includeParts = false): MessageOrder {
  const { lineage } = state.transcriptChanges
  let order = indexes.get(lineage)
  if (!order) {
    order = new MessageOrder()
    indexes.set(lineage, order)
  }
  order.advance(state)
  if (includeParts) order.ensureContributions(state.messages)
  return order
}
