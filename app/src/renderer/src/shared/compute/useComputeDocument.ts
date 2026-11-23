import { useEffect, useMemo, useState } from 'react'
import { computeClient } from './client'
import { revisionOf } from './documents'
import type { LineNumbers } from './diffSource'
import type { DocRef, Lane } from './protocol'

export function useComputeDocument(
  id: string,
  text: string,
  lane: Lane,
  revisionSource?: object,
  lines?: LineNumbers,
  enabled = true
): { ref: DocRef; ready: boolean; unavailable: boolean } {
  const ref = useMemo(
    () => ({ id, revision: revisionOf(revisionSource ?? { text }) }),
    [id, text, revisionSource]
  )
  const [state, setState] = useState<{ ref: DocRef; available: boolean } | null>(null)
  useEffect(() => {
    if (!enabled) return
    const lease = computeClient().openDocument(ref, { text, lines }, lane)
    const update = (): void => setState({ ref, available: lease.available })
    const unsubscribe = lease.onAvailable(update)
    update()
    return () => {
      unsubscribe()
      lease.release()
    }
  }, [ref, text, lines, lane, enabled])
  return {
    ref,
    ready: state?.ref === ref && state.available,
    unavailable: state?.ref === ref && !state.available
  }
}
