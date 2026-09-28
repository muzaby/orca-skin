import { useEffect, useRef, useState } from 'react'
import { artifactApi } from '../../../shared/api/ipc'
import { i18n, type MessageKey } from '../../../shared/i18n'
import { reportArtifactIssue } from '../lib/artifactIssueReport'
import { reportError } from '../../../shared/errors'
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

  // 0242 ΔV2 (D-011) — 뷰어 상단 status 줄은 진행·성공만 말한다. 실패 사유는 사용자가 요청한
  // 동작의 결과이므로 toast 로 알린다(뷰어를 닫았어도 알린다).
  const runAction = async <T>(
    operation: ViewerAction,
    execute: () => Promise<T>,
    settle: (result: T) => MessageKey | null
  ): Promise<void> => {
    if (actionRef.current) return
    actionRef.current = true
    setAction(operation)
    setFeedback(null)
    try {
      const result = await execute()
      const success = settle(result)
      if (success && current()) setFeedback(success)
    } catch (error) {
      reportError({
        event: 'artifacts.viewer-action.failed',
        scope: 'artifacts',
        title: 'actionFailed',
        error,
        detail: `${artifact.filename}: ${i18n.t(
          operation === 'copy' ? 'chat.artifactViewer.copyFailed' : 'chat.artifacts.failed'
        )}`,
        data: { operation }
      })
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
      () => 'chat.artifactViewer.copied'
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
      (saved) => {
        if (saved.outcome === 'cancelled') return 'chat.artifacts.cancelled'
        if (saved.outcome === 'completed' && saved.items[0]?.outcome === 'saved')
          return 'chat.artifacts.saved'
        reportArtifactIssue({
          event: 'artifacts.viewer-download.failed',
          filename: artifact.filename,
          reason: saved.reason ?? saved.items[0]?.reason
        })
        return null
      }
    )
  }
  return { action, feedback, copy, download }
}
