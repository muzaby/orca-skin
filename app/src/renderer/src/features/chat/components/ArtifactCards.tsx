import { useEffect, useEffectEvent } from 'react'
import type { ArtifactRef } from '../../../../../shared/artifacts'
import { Button } from '../../../shared/ui/Button'
import { openConfirmDialog } from '../../../shared/ui/confirmDialogStore'
import { useI18n } from '../../../shared/i18n'
import { useChatSession, useChatStore } from '../store/chatStore'
import { openArtifactViewer } from '../store/artifactViewerStore'
import {
  acquireArtifacts,
  refreshArtifactStatuses,
  runArtifactAction,
  useArtifactStore,
  type ArtifactFileView,
  type ArtifactOperation
} from '../store/artifactStore'
import { artifactOperationIssues } from '../lib/artifactOperationIssues'
import { reportArtifactIssue } from '../lib/artifactIssueReport'
import { ArtifactCard } from './ArtifactCard'

const EMPTY_FILES: Record<string, ArtifactFileView> = {}

export function ArtifactCards({
  artifacts,
  saveArtifacts = artifacts,
  variant = 'transcript'
}: {
  artifacts: readonly ArtifactRef[]
  saveArtifacts?: readonly ArtifactRef[]
  variant?: 'transcript' | 'list'
}): React.JSX.Element | null {
  const { tr } = useI18n()
  const sessionId = useChatSession((session) => session.sessionId)
  const activeKey = useChatStore((state) => state.activeKey)
  const files = useArtifactStore((state) =>
    sessionId ? (state.sessions[sessionId]?.files ?? EMPTY_FILES) : EMPTY_FILES
  )
  const getSnapshot = useEffectEvent(() => ({ artifacts, saveArtifacts }))
  const visibleKey = JSON.stringify(artifacts.map((ref) => [ref.publicationId, ref.artifactFileId]))
  const collectionKey = JSON.stringify(
    saveArtifacts.map((ref) => [ref.publicationId, ref.artifactFileId])
  )
  useEffect(() => {
    if (!sessionId) return
    const snapshot = getSnapshot()
    const release = acquireArtifacts(sessionId, snapshot.saveArtifacts)
    void refreshArtifactStatuses(sessionId, snapshot.artifacts)
    return release
  }, [sessionId, visibleKey, collectionKey])
  if (!artifacts.length || !sessionId) return null

  const run = async (refs: readonly ArtifactRef[], operation: ArtifactOperation): Promise<void> => {
    const captured = [...refs]
    const next = await runArtifactAction(sessionId, captured, operation)
    // 0242 ΔV2 (D-011) — 동작 실패 사유는 카드 아래가 아니라 toast 로 알린다. 화면을 떠난 뒤
    // 끝난 동작도 사용자가 요청한 것이므로 결과를 버리지 않는다. `busy` 는 이미 진행 중인 동작이라
    // 실패가 아니다(카드 버튼이 그동안 비활성이다).
    for (const issue of artifactOperationIssues(next)) {
      if (issue.reason === 'busy') continue
      const ref = issue.publicationId
        ? captured.find((item) => item.publicationId === issue.publicationId)
        : captured.length === 1
          ? captured[0]
          : undefined
      reportArtifactIssue({
        event: `artifacts.${operation}.failed`,
        filename: ref?.filename ?? issue.publicationId,
        reason: issue.reason,
        ...(issue.unrecorded ? { messageKey: 'chat.artifacts.trashedUnrecorded' as const } : {})
      })
    }
  }
  const act = (artifact: ArtifactRef, operation: ArtifactOperation): void => {
    if (operation !== 'trash') {
      void run([artifact], operation)
      return
    }
    openConfirmDialog({
      title: tr('chat.artifacts.trashTitle'),
      message: tr('chat.artifacts.trashMessage'),
      confirmLabel: tr('chat.artifacts.trash'),
      danger: true,
      onConfirm: () => {
        void run([artifact], 'trash')
      }
    })
  }
  return (
    <div className={`flex min-w-0 flex-col ${variant === 'list' ? 'gap-1' : 'gap-2'}`}>
      {variant === 'transcript' && saveArtifacts.length > 1 && (
        <div className="flex justify-end">
          <Button
            size="small"
            disabled={saveArtifacts.some((ref) => files[ref.artifactFileId]?.busy)}
            onClick={() => {
              void run(saveArtifacts, 'save')
            }}
          >
            {tr('chat.artifacts.saveAll')}
          </Button>
        </div>
      )}
      {artifacts.map((artifact) => (
        <ArtifactCard
          key={artifact.publicationId}
          artifact={artifact}
          variant={variant}
          file={files[artifact.artifactFileId]}
          onPreview={(selected, origin) => {
            if (useChatStore.getState().activeKey !== activeKey) return
            void openArtifactViewer(activeKey, sessionId, selected, origin)
          }}
          onAction={act}
        />
      ))}
    </div>
  )
}
