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
