import { useWorkerRetry } from '../../../shared/compute/useWorkerRetry'
import { useComputePaint } from '../../../shared/compute/diagnostics'
import { useEffect, useMemo, useRef, useState } from 'react'
import { computeClient, type ComputeHandle, type Priority } from '../../../shared/compute/client'
import { diffViewRows, type DiffModel } from '../../../shared/compute/diffView'
import { type DiffOptions, type DiffSourceRef } from '../../../shared/compute/diffSource'
import { requestKey, type ComputeResults } from '../../../shared/compute/protocol'

type Result = ComputeResults['diffView']
function useDiffWindow(
  source: DiffSourceRef,
  options: DiffOptions,
  model: DiffModel | null,
  start: number,
  end: number,
  ready: boolean,
  priority: Priority = 'visible'
): { data: Result | null | undefined; rowAt(index: number): Result['rows'][number] | undefined } {
  const request = useMemo(
    () => ({ kind: 'diffView' as const, source, options, start, end }),
    [source, options, start, end]
  )
  const key = requestKey(request)
  const local = useMemo(
    () => (model ? diffViewRows(model, options, start, end) : undefined),
    [model, options, start, end]
  )
  const retryWorker = useWorkerRetry('compute', request)
  const [state, setState] = useState<{
    key: string
    source: DiffSourceRef
    options: DiffOptions
    start: number
    result: Result | null
  } | null>(null)
  const handle = useRef<ComputeHandle<Result> | null>(null)
  const currentPriority = useRef(priority)
  useEffect(() => {
    currentPriority.current = priority
    handle.current?.setPriority(priority)
  }, [priority])
  useEffect(() => {
    if (model || !ready || start === end) return
    const task = retryWorker(() =>
      computeClient().request<'diffView'>(request, { priority: currentPriority.current })
    )
    handle.current = task
    let active = true
    void task.promise.then(
      (result) => {
        if (active) setState({ key, source, options, start, result })
      },
      () => {
        if (active) setState({ key, source, options, start, result: null })
      }
    )
    return () => {
      active = false
      handle.current = null
      task.cancel()
    }
  }, [request, model, ready, key, start, end, source, options, retryWorker])
  useComputePaint(!local && state?.key === key && state.result ? key : null)
  const data = local ?? (state?.key === key ? state.result : undefined)
  // Rows present in both ranges retain their DOM endpoints until the worker replies.
  const retained =
    ready && !model && state?.source === source && state.options === options ? state : null
  function rowAt(index: number): Result['rows'][number] | undefined {
    if (data !== undefined) return data?.rows[index - start]
    return retained?.result?.rows[index - retained.start]
  }
  return { data, rowAt }
}
// A request containing a visible row competes at visible priority, including a mixed window.
export function diffWindowPriority(
  start: number,
  end: number,
  range: { startIndex: number; endIndex: number } | null
): Priority {
  return range && start <= range.endIndex && end > range.startIndex ? 'visible' : 'background'
}
export function useDiffViewWindow(
  ...args: Parameters<typeof useDiffWindow>
): Result | null | undefined {
  return useDiffWindow(...args).data
}
export function useDiffRowWindow(
  ...args: Parameters<typeof useDiffWindow>
): ReturnType<typeof useDiffWindow> {
  return useDiffWindow(...args)
}
