import { useEffect, useMemo, useState } from 'react'
import { computeClient } from '../../../shared/compute/client'
import { diffStatsWithinBudget } from '../../../shared/compute/inline'
import { DIFF_INLINE_MAX_CHARS, DIFF_INLINE_MAX_LINES } from '../../../shared/compute/limits'
import { countLinesUpTo } from '../../../shared/compute/diffModel'
import type { DiffStat, DiffStatSource } from '../../../shared/compute/diffStats'

let sequence = 0

function inlineHeaderStat(sources: readonly DiffStatSource[] | null): DiffStat | null {
  if (!sources) return null
  // Large patches use the same header budget as before/after pairs.
  let chars = 0
  let lines = 0
  for (const source of sources) {
    if (source.kind !== 'patch') continue
    chars += source.patch.length
    if (chars > DIFF_INLINE_MAX_CHARS) return null
    lines += countLinesUpTo(source.patch, DIFF_INLINE_MAX_LINES - lines)
    if (lines > DIFF_INLINE_MAX_LINES) return null
  }
  return diffStatsWithinBudget(sources)
}

export function useDiffStat(sources: readonly DiffStatSource[] | null): DiffStat | null {
  const inline = useMemo(() => inlineHeaderStat(sources), [sources])
  const [computed, setComputed] = useState<{ sources: readonly DiffStatSource[]; stat: DiffStat }>()
  useEffect(() => {
    if (!sources || inline) return
    let active = true
    const handle = computeClient().request(
      { kind: 'diffStat', sources, sequence: ++sequence },
      { cacheable: false }
    )
    void handle.promise.then(
      (stat) => {
        if (active) setComputed({ sources, stat })
      },
      () => {}
    )
    return () => {
      active = false
      handle.cancel()
    }
  }, [sources, inline])
  return inline ?? (computed?.sources === sources ? computed.stat : null)
}
