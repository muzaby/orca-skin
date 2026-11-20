export const TRANSCRIPT_CHANGE_LOG_MAX = 64

export type TranscriptChange =
  | { kind: 'append' | 'remove' | 'prepend'; ids: readonly string[] }
  | { kind: 'replace'; id: string; partsFrom: number }
  | { kind: 'reset'; complete: boolean }

export interface TranscriptRevision {
  readonly lineage: object
  readonly revision: number
}

export interface TranscriptChanges extends TranscriptRevision {
  readonly log: readonly TranscriptChange[]
}

export function newTranscriptChanges(): TranscriptChanges {
  return { lineage: {}, revision: 0, log: [] }
}

export function recordChange(log: TranscriptChanges, change: TranscriptChange): TranscriptChanges {
  return {
    lineage: log.lineage,
    revision: log.revision + 1,
    log: [...log.log.slice(-(TRANSCRIPT_CHANGE_LOG_MAX - 1)), change]
  }
}

export function changesSince(
  log: TranscriptChanges,
  cursor: TranscriptRevision | undefined
): readonly TranscriptChange[] | 'reset' {
  if (!cursor || cursor.lineage !== log.lineage) return 'reset'
  const distance = log.revision - cursor.revision
  if (distance < 0 || distance > log.log.length) return 'reset'
  return distance === 0 ? [] : log.log.slice(-distance)
}

export function foldChanges(changes: readonly TranscriptChange[]): ReadonlyMap<string, number> {
  const affected = new Map<string, number>()
  for (const change of changes) {
    switch (change.kind) {
      case 'reset':
        affected.clear()
        break
      case 'append':
      case 'prepend':
        for (const id of change.ids) affected.set(id, 0)
        break
      case 'remove':
        for (const id of change.ids) affected.set(id, Infinity)
        break
      case 'replace':
        affected.set(change.id, Math.min(affected.get(change.id) ?? Infinity, change.partsFrom))
        break
    }
  }
  return affected
}

// Final insertions in transcript order. A consumer may already own an ID that
// was removed and inserted again while it was behind.
export function changedMessageLocations(changes: readonly TranscriptChange[]): {
  prependedIds: string[]
  appendedIds: string[]
  relocatedIds: Set<string>
} {
  const removed = new Set<string>()
  const relocatedIds = new Set<string>()
  const seen = new Set<string>()
  const prependedIds: string[] = []
  const appendedIds: string[] = []
  for (const change of changes) {
    if (change.kind === 'remove') for (const id of change.ids) removed.add(id)
    else if (change.kind === 'append' || change.kind === 'prepend') {
      for (const id of change.ids) if (removed.has(id)) relocatedIds.add(id)
    }
  }
  // Walk from the most recent insertion: later pages precede earlier ones,
  // while later appends follow earlier ones. A later removal wins either way.
  for (let i = changes.length - 1; i >= 0; i--) {
    const change = changes[i]
    if (change.kind === 'replace' || change.kind === 'reset') continue
    const ids = change.ids
    for (let j = 0; j < ids.length; j++) {
      const id = ids[change.kind === 'append' ? ids.length - 1 - j : j]
      if (seen.has(id)) continue
      seen.add(id)
      if (change.kind === 'prepend') prependedIds.push(id)
      if (change.kind === 'append') appendedIds.push(id)
    }
  }
  return { prependedIds, appendedIds: appendedIds.reverse(), relocatedIds }
}
