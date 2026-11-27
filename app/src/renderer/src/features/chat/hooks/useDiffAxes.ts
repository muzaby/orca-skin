import { useId, useMemo } from 'react'
import type { DiffModel } from '../../../shared/compute/diffView'
import type { DocRef } from '../../../shared/compute/protocol'
import { useComputeDocument } from '../../../shared/compute/useComputeDocument'

export interface DiffAxes {
  old: DocRef
  new: DocRef
  ready: boolean
}
export function useDiffAxes(
  model: DiffModel | null,
  documentId?: string,
  revisionSource?: object,
  ignoreWhitespace = false
): DiffAxes | null {
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
  const oldId = useId(),
    newId = useId(),
    suffix = ignoreWhitespace ? 'w' : 'k'
  const old = useComputeDocument(
    documentId ? documentId + ':old:' + suffix : oldId,
    text?.old ?? '',
    'compute',
    revisionSource ?? model ?? undefined,
    undefined,
    !!model
  )
  const next = useComputeDocument(
    documentId ? documentId + ':new:' + suffix : newId,
    text?.new ?? '',
    'compute',
    revisionSource ?? model ?? undefined,
    undefined,
    !!model
  )
  return useMemo(
    () => (model ? { old: old.ref, new: next.ref, ready: old.ready && next.ready } : null),
    [model, old.ref, next.ref, old.ready, next.ready]
  )
}
