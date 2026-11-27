import { useWorkerRetry } from '../../../shared/compute/useWorkerRetry'
import { useEffect, useMemo, useState } from 'react'
import { computeClient } from '../../../shared/compute/client'
import { diffLinesWithinCap } from '../../../shared/compute/inline'
import type { DiffLine } from '../lib/diffLines'

export type DiffLinesState =
  { status: 'ready'; lines: DiffLine[] } | { status: 'loading' } | { status: 'failed' }

const LOADING: DiffLinesState = { status: 'loading' }

// 두 문자열의 diff 줄 (0324 AC10). 줄 수 합이 상한 이하면 같은 렌더에서 결과가 나오고,
// 넘으면 계산 워커의 결과가 올 때까지 `loading` 이다. 워커가 실패하면 `failed` — UI 스레드에서
// 대신 계산하지 않는다.
export function useDiffLines(oldValue: string, newValue: string): DiffLinesState {
  const inline = useMemo(() => diffLinesWithinCap(oldValue, newValue), [oldValue, newValue])
  const retryWorker = useWorkerRetry('compute', inline)
  const [remote, setRemote] = useState<{
    oldValue: string
    newValue: string
    state: DiffLinesState
  } | null>(null)

  useEffect(() => {
    if (inline) return
    const handle = retryWorker(() =>
      computeClient().request({ kind: 'diffLines', oldValue, newValue })
    )
    let cancelled = false
    void handle.promise.then(
      ({ lines }) => {
        if (!cancelled) setRemote({ oldValue, newValue, state: { status: 'ready', lines } })
      },
      () => {
        if (!cancelled) setRemote({ oldValue, newValue, state: { status: 'failed' } })
      }
    )
    return () => {
      cancelled = true
      handle.cancel()
    }
  }, [inline, oldValue, newValue, retryWorker])

  return useMemo<DiffLinesState>(() => {
    if (inline) return { status: 'ready', lines: inline }
    return remote?.oldValue === oldValue && remote.newValue === newValue ? remote.state : LOADING
  }, [inline, remote, oldValue, newValue])
}
