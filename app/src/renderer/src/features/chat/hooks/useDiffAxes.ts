import { useId, useMemo } from 'react'
import type { DiffModel } from '../../../shared/compute/diffView'
import type { DocRef } from '../../../shared/compute/protocol'
import { useComputeDocument } from '../../../shared/compute/useComputeDocument'

export interface DiffAxes {
  old: DocRef
  new: DocRef
  ready: boolean
}
export function useDiffAxes(model: DiffModel | null): DiffAxes | null {
  const text = useMemo(
    () =>
      model
        ? {
            old: model.lines
              .filter((l) => l.type !== 'added')
              .map((l) => l.text)
              .join('\n'),
            new: model.lines
              .filter((l) => l.type !== 'removed')
              .map((l) => l.text)
              .join('\n')
          }
        : null,
    [model]
  )
  const old = useComputeDocument(
    useId(),
    text?.old ?? '',
    'compute',
    model ?? undefined,
    undefined,
    !!model
  )
  const next = useComputeDocument(
    useId(),
    text?.new ?? '',
    'compute',
    model ?? undefined,
    undefined,
    !!model
  )
  return useMemo(
    () => (model ? { old: old.ref, new: next.ref, ready: old.ready && next.ready } : null),
    [model, old.ref, next.ref, old.ready, next.ready]
  )
}
