import { useMemo, useEffect, useState } from 'react'
import { computeClient } from '../../../shared/compute/client'
import { diffViewLocate, diffViewContext, type DiffModel } from '../../../shared/compute/diffView'
import { type DiffOptions, type DiffSourceRef } from '../../../shared/compute/diffSource'
import {
  requestKey,
  type ComputeResults,
  type ComputeRequest
} from '../../../shared/compute/protocol'

type Marker = { oldLine: number | null; newLine: number | null }
type AnchorKind = 'diffLocate' | 'diffContext'
function useAnchorRequest<K extends AnchorKind>(
  request: Extract<ComputeRequest, { kind: K }> | null,
  ready: boolean
): ComputeResults[K] | undefined {
  const [state, setState] = useState<{ key: string; value: ComputeResults[K] } | null>(null)
  const key = request && requestKey(request)
  useEffect(() => {
    if (!request || !ready || !key) return
    let active = true
    const task = computeClient().request<K>(request)
    void task.promise.then(
      (value) => {
        if (active) setState({ key, value })
      },
      () => {}
    )
    return () => {
      active = false
      task.cancel()
    }
  }, [request, ready, key])
  return state?.key === key ? state?.value : undefined
}
export function useDiffAnchor(
  source: DiffSourceRef,
  options: DiffOptions,
  model: DiffModel | null,
  marker: Marker | null,
  ready: boolean
): ComputeResults['diffLocate'] | undefined {
  const old = marker?.oldLine,
    next = marker?.newLine
  const request = useMemo(
    () =>
      old === undefined || next === undefined
        ? null
        : {
            kind: 'diffLocate' as const,
            source,
            options,
            anchors: [{ oldLine: old, newLine: next }]
          },
    [old, next, source, options]
  )
  const remote = useAnchorRequest<'diffLocate'>(model ? null : request, ready)
  return useMemo(
    () => (model && request ? diffViewLocate(model, options, request.anchors) : remote),
    [model, request, options, remote]
  )
}
export function useDiffContext(
  source: DiffSourceRef,
  ignoreWhitespace: boolean,
  model: DiffModel | null,
  lineIndex: number,
  ready: boolean
): ComputeResults['diffContext'] | undefined {
  const request = useMemo(
    () =>
      lineIndex < 0 ? null : { kind: 'diffContext' as const, source, ignoreWhitespace, lineIndex },
    [source, ignoreWhitespace, lineIndex]
  )
  const remote = useAnchorRequest<'diffContext'>(model ? null : request, ready)
  return useMemo(
    () => (model && request ? diffViewContext(model, lineIndex) : remote),
    [model, request, lineIndex, remote]
  )
}
