import { useCallback, useEffect, useMemo, useState } from 'react'
import type { GitDiffSummary } from '../../../../../../shared/ipc'
import { gitApi } from '../../../../shared/api/ipc'
import type { DiffLine } from '../../lib/diffLines'
import type { GitPeekTarget } from '../../reducer/chatReducer'
import { chatActions, useChatSession, useChatStore } from '../../store/chatStore'
import { DiffPeek } from './DiffPeek'
import {
  handleDiffPeekBodyResult,
  registerDiffPeekBodyRequest,
  type DiffPeekBodyBridge
} from './diffRequirementBridge'
import { createDiffRequirementItem } from './diffRequirements'
import {
  createDiffPeekBodyRequestOwner,
  diffPeekBodyKey,
  diffPeekFileRequest,
  type DiffPeekBodyState
} from './diffFileCache'
import { SessionChangesList } from './SessionChangesList'

export interface DiffTileContentViewProps {
  summary: GitDiffSummary | null
  peekTarget: GitPeekTarget | null
  expandedCommitIds: ReadonlySet<string>
  currentBody: DiffPeekBodyState | null
  requirements?: Parameters<typeof DiffPeek>[0]['requirements']
  draft?: Parameters<typeof DiffPeek>[0]['draft']
  onToggleCommit: (sha: string) => void
  onOpenPeek: (target: GitPeekTarget) => void
  onBack: () => void
  onDraftChange?: Parameters<typeof DiffPeek>[0]['onDraftChange']
  onAddRequirement?: Parameters<typeof DiffPeek>[0]['onAddRequirement']
  onRemoveRequirement?: Parameters<typeof DiffPeek>[0]['onRemoveRequirement']
}

/** props-only view boundary. Store/IPC ownership remains in the container below. */
export function DiffTileContentView({
  summary,
  peekTarget,
  expandedCommitIds,
  currentBody,
  requirements = [],
  draft = null,
  onToggleCommit,
  onOpenPeek,
  onBack,
  onDraftChange,
  onAddRequirement,
  onRemoveRequirement
}: DiffTileContentViewProps): React.JSX.Element {
  if (summary && peekTarget) {
    return (
      <DiffPeek
        summary={summary}
        target={peekTarget}
        currentBody={currentBody}
        requirements={requirements}
        draft={draft}
        onBack={onBack}
        onNavigate={onOpenPeek}
        onDraftChange={onDraftChange}
        onAddRequirement={onAddRequirement}
        onRemoveRequirement={onRemoveRequirement}
      />
    )
  }
  return (
    <SessionChangesList
      summary={summary}
      expandedCommitIds={expandedCommitIds}
      onToggleCommit={onToggleCommit}
      onOpenPeek={onOpenPeek}
    />
  )
}

/**
 * Tile lifecycle owner. Summary is deliberately absent here: `useGitSnapshot` is the session-surface
 * query owner. This container owns only the current peek body and guards it by identity+generation.
 */
export function DiffTileContent(): React.JSX.Element {
  const cwd = useChatSession((state) => state.cwd)
  const sessionId = useChatSession((state) => state.sessionId)
  const sessionKey = useChatStore((state) => state.activeKey)
  const summary = useChatSession((state) => state.gitSnapshot.summary)
  const peekTarget = useChatSession((state) => state.gitSnapshot.peekTarget)
  const expandedCommitIds = useChatSession((state) => state.gitSnapshot.expandedCommitIds)
  const summaryGeneration = useChatSession((state) => state.gitSnapshotRequest?.generation ?? 0)
  const requirements = useChatSession((state) => state.diffRequirements)
  const draft = useChatSession((state) => state.diffRequirementDraft)
  const [bodyOwner] = useState(createDiffPeekBodyRequestOwner)
  const [body, setBody] = useState<DiffPeekBodyState | null>(null)
  const bodyKey = useMemo(
    () =>
      cwd && peekTarget ? diffPeekBodyKey(cwd, sessionId, peekTarget, summaryGeneration) : null,
    [cwd, peekTarget, sessionId, summaryGeneration]
  )
  // Same relative path in a new identity is never rendered from a retained body cache.
  const currentBody = bodyKey && body?.key === bodyKey ? body : null

  useEffect(() => () => bodyOwner.invalidate(), [bodyOwner])

  useEffect(() => {
    if (!cwd || !peekTarget || !bodyKey || body?.key === bodyKey) return
    const capturedSessionKey = sessionKey
    const capturedSessionId = sessionId
    const capturedPath = peekTarget.path
    const bridge: DiffPeekBodyBridge = {
      setBody,
      setDiffRequirementBodyRequest: chatActions.setDiffRequirementBodyRequest,
      reanchorDiffRequirements: chatActions.reanchorDiffRequirements
    }
    const request = bodyOwner.run(
      bodyKey,
      () => gitApi.diffFile(diffPeekFileRequest(cwd, sessionId, peekTarget)),
      (request, content) =>
        handleDiffPeekBodyResult({
          bridge,
          sessionKey: capturedSessionKey,
          sessionId: capturedSessionId,
          path: capturedPath,
          request,
          content
        }),
      (request) => setBody({ ...request, content: { kind: 'unavailable', reason: 'error' } })
    )
    registerDiffPeekBodyRequest({
      bridge,
      sessionKey: capturedSessionKey,
      sessionId: capturedSessionId,
      path: capturedPath,
      request
    })
  }, [body?.key, bodyKey, bodyOwner, cwd, peekTarget, sessionId, sessionKey])

  const onAddRequirement = useCallback(
    ({
      lines,
      lineIndex,
      comment
    }: {
      lines: readonly DiffLine[]
      lineIndex: number
      comment: string
    }) => {
      if (!summary || !peekTarget || !sessionId) return
      chatActions.addDiffRequirement(
        createDiffRequirementItem({
          id: crypto.randomUUID(),
          sessionId,
          base: summary.base,
          filePath: peekTarget.path,
          lines,
          lineIndex,
          comment,
          createdAt: Date.now()
        })
      )
    },
    [peekTarget, sessionId, summary]
  )

  return (
    <DiffTileContentView
      summary={summary}
      peekTarget={peekTarget}
      expandedCommitIds={new Set(expandedCommitIds)}
      currentBody={currentBody}
      requirements={requirements}
      draft={draft}
      onToggleCommit={chatActions.toggleGitSnapshotCommitExpanded}
      onOpenPeek={chatActions.openGitSnapshotPeek}
      onBack={chatActions.closeGitSnapshotPeek}
      onDraftChange={chatActions.setDiffRequirementDraft}
      onAddRequirement={onAddRequirement}
      onRemoveRequirement={chatActions.removeDiffRequirement}
    />
  )
}
