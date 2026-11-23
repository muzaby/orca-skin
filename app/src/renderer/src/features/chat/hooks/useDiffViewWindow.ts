import { useComputePaint } from '../../../shared/compute/diagnostics'
import { useEffect, useMemo, useState } from 'react'
import { computeClient } from '../../../shared/compute/client'
import { diffViewRows, type DiffModel } from '../../../shared/compute/diffView'
import { type DiffOptions, type DiffSourceRef } from '../../../shared/compute/diffSource'
import { requestKey, type ComputeResults } from '../../../shared/compute/protocol'

export function useDiffViewWindow(
  source: DiffSourceRef,
  options: DiffOptions,
  model: DiffModel | null,
  start: number,
  end: number,
  ready: boolean
): ComputeResults['diffView'] | null | undefined {
  const request = useMemo(
    () => ({ kind: 'diffView' as const, source, options, start, end }),
    [source, options, start, end]
  )
  const key = requestKey(request)
  const local = useMemo(
    () => (model ? diffViewRows(model, options, start, end) : undefined),
    [model, options, start, end]
  )
  const [state, setState] = useState<{
    key: string
    result: ComputeResults['diffView'] | null
  } | null>(null)
  useEffect(() => {
    if (model || !ready || start === end) return
    const task = computeClient().request<'diffView'>(request)
    let active = true
    void task.promise.then(
      (result) => {
        if (active) setState({ key, result })
      },
      () => {
        if (active) setState({ key, result: null })
      }
    )
    return () => {
      active = false
      task.cancel()
    }
  }, [request, model, ready, key, start, end])
  useComputePaint(!local && state?.key === key && state.result ? key : null)
  return local ?? (state?.key === key ? state.result : undefined)
}
