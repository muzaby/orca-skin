import { useEffect, useRef, useState } from 'react'
import { artifactApi } from '../../../shared/api/ipc'
import { i18n } from '../../../shared/i18n'
import { reportArtifactIssue } from '../lib/artifactIssueReport'
import { reportError } from '../../../shared/errors'
import { useArtifactViewerStore, type ArtifactViewerSelection } from '../store/artifactViewerStore'

type ViewerAction = 'copy' | 'download'

export function useArtifactViewerActions(selection: ArtifactViewerSelection): {
  action: ViewerAction | null
  // 마지막 복사가 성공했는가 — 복사 버튼 아이콘(체크)만 이 값을 쓴다.
  copied: boolean
  copy: () => Promise<void>
  download: () => Promise<void>
} {
  const [action, setAction] = useState<ViewerAction | null>(null)
  const actionRef = useRef(false)
  const [copied, setCopied] = useState(false)
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

  // 0257 D-001 — 뷰어는 복사·다운로드의 진행·성공·취소 문구를 쓰지 않는다(status 줄 없음).
  // 복사 성공은 아이콘 체크로만 보이고, 실패 사유는 사용자가 요청한 동작의 결과이므로
  // toast 로 알린다(0242 ΔV2 D-011 — 뷰어를 닫았어도 알린다).
  const runAction = async <T>(
    operation: ViewerAction,
    execute: () => Promise<T>,
    settle: (result: T) => boolean
  ): Promise<void> => {
    if (actionRef.current) return
    actionRef.current = true
    setAction(operation)
    setCopied(false)
    try {
      const result = await execute()
      const copiedNow = settle(result)
      if (copiedNow && current()) setCopied(true)
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
      () => true
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
        if (saved.outcome === 'cancelled') return false
        if (saved.outcome === 'completed' && saved.items[0]?.outcome === 'saved') return false
        reportArtifactIssue({
          event: 'artifacts.viewer-download.failed',
          filename: artifact.filename,
          reason: saved.reason ?? saved.items[0]?.reason
        })
        return false
      }
    )
  }
  return { action, copied, copy, download }
}
