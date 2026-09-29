export type ArchiveMailRelationKind = 'reply' | 'reference'
export type ArchiveMailRelationResolution = 'resolved' | 'missing' | 'ambiguous' | 'cycle' | 'self'

export interface ArchiveMailRelationMessage {
  readonly id: string
  readonly messageId: string | null
  readonly inReplyTo: string | null
  readonly references: string | null
}

export interface ArchiveMailRelation {
  readonly childMailId: string
  readonly parentMessageId: string
  readonly parentMailId: string | null
  readonly kind: ArchiveMailRelationKind
  readonly resolution: ArchiveMailRelationResolution
}

function normalizeMessageId(value: string): string {
  return value.trim().replace(/^<|>$/g, '').toLocaleLowerCase('en-US')
}

function messageIds(value: string | null): string[] {
  if (!value?.trim()) return []
  const bracketed = value.match(/<[^<>]+>/g)
  const candidates = bracketed ?? value.split(/\s+/)
  return [...new Set(candidates.map(normalizeMessageId).filter(Boolean))]
}

interface RelationDraft {
  readonly childMailId: string
  readonly parentMessageId: string
  readonly kind: ArchiveMailRelationKind
}

function draftsFor(messages: readonly ArchiveMailRelationMessage[]): RelationDraft[] {
  const drafts: RelationDraft[] = []
  for (const message of messages) {
    const reply = messageIds(message.inReplyTo)[0]
    if (reply) {
      drafts.push({ childMailId: message.id, parentMessageId: reply, kind: 'reply' })
    }
    for (const parentMessageId of messageIds(message.references)) {
      drafts.push({ childMailId: message.id, parentMessageId, kind: 'reference' })
    }
  }
  const unique = new Map<string, RelationDraft>()
  for (const draft of drafts) {
    unique.set(`${draft.childMailId}\0${draft.parentMessageId}\0${draft.kind}`, draft)
  }
  return [...unique.values()].sort(
    (left, right) =>
      left.childMailId.localeCompare(right.childMailId) ||
      left.parentMessageId.localeCompare(right.parentMessageId) ||
      (left.kind === right.kind ? 0 : left.kind === 'reply' ? -1 : 1)
  )
}

function wouldCreateCycle(
  childMailId: string,
  parentMailId: string,
  parentsByChild: ReadonlyMap<string, ReadonlySet<string>>
): boolean {
  const pending = [parentMailId]
  const visited = new Set<string>()
  while (pending.length > 0) {
    const current = pending.pop()!
    if (current === childMailId) return true
    if (visited.has(current)) continue
    visited.add(current)
    pending.push(...(parentsByChild.get(current) ?? []))
  }
  return false
}

/** Resolve only explicit Reply/References headers; subject similarity never creates an edge. */
export function resolveArchiveMailRelations(
  messages: readonly ArchiveMailRelationMessage[]
): ArchiveMailRelation[] {
  const byMessageId = new Map<string, Set<string>>()
  for (const message of messages) {
    const messageId = message.messageId ? normalizeMessageId(message.messageId) : ''
    if (!messageId) continue
    const candidates = byMessageId.get(messageId) ?? new Set<string>()
    candidates.add(message.id)
    byMessageId.set(messageId, candidates)
  }

  const parentsByChild = new Map<string, Set<string>>()
  return draftsFor(messages).map((draft) => {
    const candidates = byMessageId.get(draft.parentMessageId)
    let resolution: ArchiveMailRelationResolution
    let parentMailId: string | null = null
    if (!candidates || candidates.size === 0) {
      resolution = 'missing'
    } else if (candidates.size > 1) {
      resolution = 'ambiguous'
    } else {
      const candidate = candidates.values().next().value as string
      if (candidate === draft.childMailId) {
        resolution = 'self'
      } else if (wouldCreateCycle(draft.childMailId, candidate, parentsByChild)) {
        resolution = 'cycle'
      } else {
        resolution = 'resolved'
        parentMailId = candidate
        const parents = parentsByChild.get(draft.childMailId) ?? new Set<string>()
        parents.add(candidate)
        parentsByChild.set(draft.childMailId, parents)
      }
    }
    return { ...draft, parentMailId, resolution }
  })
}
