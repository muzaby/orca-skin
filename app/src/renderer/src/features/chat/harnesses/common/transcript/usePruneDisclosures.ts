import { useEffect, useRef } from 'react'
import type { BlockSnapshot } from '../../../lib/transcript/blockList'
import {
  changesSince,
  type TranscriptChanges,
  type TranscriptRevision
} from '../../../lib/transcript/changeLog'
import { useChatStore } from '../../../store/chatStore'
import { pruneDisclosures } from '../../../store/disclosureStore'

/** Apply the latest reset observed between renders to the current session's disclosure keys. */
export function usePruneDisclosures<Block extends { key: string; partKeys?: readonly string[] }>(
  sessionKey: string,
  changes: TranscriptChanges,
  snapshot: BlockSnapshot<Block>
): void {
  const seen = useRef<{ sessionKey: string; cursor: TranscriptRevision } | null>(null)
  useEffect(() => {
    const cursor = seen.current?.sessionKey === sessionKey ? seen.current.cursor : undefined
    const batch = changesSince(changes, cursor)
    seen.current = { sessionKey, cursor: { lineage: changes.lineage, revision: changes.revision } }
    const retained = batch === 'reset' ? changes.log : batch
    let complete: boolean | undefined
    for (let index = retained.length - 1; index >= 0; index--) {
      const change = retained[index]
      if (change.kind === 'reset') {
        complete = change.complete
        break
      }
    }
    // Beyond the retained log the current session knows whether its snapshot is complete.
    if (complete === undefined && batch === 'reset' && changes.revision > changes.log.length) {
      complete = useChatStore.getState().sessions[sessionKey]?.session.historyComplete
    }
    if (!complete) return
    const keys = new Set<string>()
    for (let index = 0; index < snapshot.count; index++) {
      const block = snapshot.blockAt(index)
      keys.add(block.key)
      for (const key of block.partKeys ?? []) keys.add(key)
    }
    pruneDisclosures(sessionKey, keys, true)
  }, [changes, sessionKey, snapshot])
}
