import { useEffect, useEffectEvent, useRef, useState } from 'react'
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
  type ArtifactOperation,
  type ArtifactOperationResult
} from '../store/artifactStore'
import { artifactOperationIssues } from '../lib/artifactOperationIssues'
import { artifactFailureKey } from '../lib/artifactFeedback'
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
  const [result, setResult] = useState<{
    sessionId: string
    result: ArtifactOperationResult
    refs: readonly ArtifactRef[]
  } | null>(null)
  const [previousSession, setPreviousSession] = useState(sessionId)
  if (previousSession !== sessionId) {
    setPreviousSession(sessionId)
    setResult(null)
  }
  const generation = useRef(0)
  const getSnapshot = useEffectEvent(() => ({ artifacts, saveArtifacts }))
  const visibleKey = JSON.stringify(artifacts.map((ref) => [ref.publicationId, ref.artifactFileId]))
  const collectionKey = JSON.stringify(
    saveArtifacts.map((ref) => [ref.publicationId, ref.artifactFileId])
  )
  useEffect(() => {
    generation.current += 1
    if (!sessionId) return
    const snapshot = getSnapshot()
    const release = acquireArtifacts(sessionId, snapshot.saveArtifacts)
    void refreshArtifactStatuses(sessionId, snapshot.artifacts)
    return () => {
      generation.current += 1
      release()
    }
  }, [sessionId, visibleKey, collectionKey])
  if (!artifacts.length || !sessionId) return null

  const run = async (refs: readonly ArtifactRef[], operation: ArtifactOperation): Promise<void> => {
    const token = ++generation.current
    const captured = [...refs]
    setResult(null)
    const next = await runArtifactAction(sessionId, captured, operation)
    if (generation.current === token) setResult({ sessionId, result: next, refs: captured })
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
  const outcome = result?.sessionId === sessionId ? result.result : undefined
  const issues = artifactOperationIssues(outcome)
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
          onRefresh={() => {
            void refreshArtifactStatuses(sessionId, [artifact])
          }}
        />
      ))}
      {issues.length > 0 && (
        <div role="status" className="text-caption text-ink2">
          {issues.map((issue, index) => (
            <div key={issue.publicationId ?? index}>
              {issue.publicationId &&
                `${result?.refs.find((ref) => ref.publicationId === issue.publicationId)?.filename ?? issue.publicationId}: `}
              {tr(
                issue.unrecorded
                  ? 'chat.artifacts.trashedUnrecorded'
                  : artifactFailureKey(issue.reason)
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
