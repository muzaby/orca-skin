/**
 * Incremental transcript panel index (EP-13 · D-033 · D-053).
 *
 * Keyed by `state.transcriptChanges.lineage`. Advances via `changesSince` + `foldChanges`,
 * retracting per-message contributions from `partsFrom` onward and re-extracting only
 * touched messages. Bumps `domainRevision` / `parentRevision` only when the derived
 * value actually changes, returning immutable cached snapshots.
 */
import type { ChatState, Message } from '../reducer/chatReducer'
import { changesSince, foldChanges, type TranscriptRevision } from './transcript/changeLog'
import { messageOrderFor } from './transcript/messageOrder'
import {
  TranscriptPanelProjection,
  type TranscriptIndex
} from '../../../../../shared/history-panels/projection'
export type {
  TranscriptIndex,
  TranscriptIndexDomain
} from '../../../../../shared/history-panels/projection'

class TranscriptIndexImpl extends TranscriptPanelProjection {
  private cursor?: TranscriptRevision
  private lastMessages?: readonly Message[]

  advance(state: ChatState): void {
    const order = messageOrderFor(state)
    const changes = changesSince(state.transcriptChanges, this.cursor)
    if (
      changes === 'reset' ||
      changes.some((change) => change.kind === 'reset') ||
      (!changes.length && state.messages !== this.lastMessages)
    ) {
      this.reset(state.messages)
    } else if (changes.length) {
      this.update(state.messages, order, foldChanges(changes))
    }
    this.cursor = {
      lineage: state.transcriptChanges.lineage,
      revision: state.transcriptChanges.revision
    }
    this.lastMessages = state.messages
  }
}

const indexByLineage = new WeakMap<object, TranscriptIndexImpl>()

export function transcriptIndexFor(state: ChatState): TranscriptIndex {
  const lineage = state.transcriptChanges.lineage
  let index = indexByLineage.get(lineage)
  if (!index) {
    index = new TranscriptIndexImpl()
    indexByLineage.set(lineage, index)
  }
  index.advance(state)
  return index
}
