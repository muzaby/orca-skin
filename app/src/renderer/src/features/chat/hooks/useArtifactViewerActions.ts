import { useEffect, useRef, useState } from 'react'
import { artifactApi } from '../../../shared/api/ipc'
import type { MessageKey } from '../../../shared/i18n'
import { artifactFailureKey } from '../lib/artifactFeedback'
import { useArtifactViewerStore, type ArtifactViewerSelection } from '../store/artifactViewerStore'

type ViewerAction = 'copy' | 'download'

export function useArtifactViewerActions(selection: ArtifactViewerSelection): {
  action: ViewerAction | null
  feedback: MessageKey | null
  copy: () => Promise<void>
  download: () => Promise<void>
} {
  const [action, setAction] = useState<ViewerAction | null>(null)
  const actionRef = useRef(false)
  const [feedback, setFeedback] = useState<MessageKey | null>(null)
  const alive = useRef(true)
  const { artifact, result } = selection
  const ready = result?.state === 'ready' ? result : null
  const image = ready?.format === 'image' || artifact.kind === 'image'
  const downloadable =
    !!ready || (result?.state === 'unavailable' && result.reason === 'unsupported-format')
  const current = (): boolean =>
    alive.current && useArtifactViewerStore.getState().selection?.request === selection.request

  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])

  const runAction = async <T>(
    operation: ViewerAction,
    execute: () => Promise<T>,
    successKey: (result: T) => MessageKey,
    failureKey: MessageKey
  ): Promise<void> => {
    if (actionRef.current) return
    actionRef.current = true
    setAction(operation)
    setFeedback(null)
    try {
      const result = await execute()
      if (current()) setFeedback(successKey(result))
    } catch {
      if (current()) setFeedback(failureKey)
    } finally {
      actionRef.current = false
      if (current()) setAction(null)
    }
  }

  const copy = async (): Promise<void> => {
    if (!ready || image) return
    await runAction(
      'copy',
      () => navigator.clipboard.writeText(ready.content),
      () => 'chat.artifactViewer.copied',
      'chat.artifactViewer.copyFailed'
    )
  }
  const download = async (): Promise<void> => {
    if (!downloadable) return
    await runAction(
      'download',
      () =>
        artifactApi.save({
          sessionId: selection.sessionId,
          publicationIds: [artifact.publicationId]
        }),
      (saved) =>
        saved.outcome === 'cancelled'
          ? 'chat.artifacts.cancelled'
          : saved.outcome === 'completed' && saved.items[0]?.outcome === 'saved'
            ? 'chat.artifacts.saved'
            : artifactFailureKey(saved.reason ?? saved.items[0]?.reason),
      'chat.artifacts.failed'
    )
  }
  return { action, feedback, copy, download }
}
