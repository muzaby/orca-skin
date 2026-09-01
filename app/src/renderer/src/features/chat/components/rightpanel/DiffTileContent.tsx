import { useEffect, useMemo, useState } from 'react'
import type { GitDiffSummary } from '../../../../../../shared/ipc'
import { gitApi } from '../../../../shared/api/ipc'
import type { GitPeekTarget } from '../../reducer/chatReducer'
import { chatActions, useChatSession } from '../../store/chatStore'
import { DiffPeek } from './DiffPeek'
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
  onToggleCommit: (sha: string) => void
  onOpenPeek: (target: GitPeekTarget) => void
  onBack: () => void
}

/** props-only view boundary. Store/IPC ownership remains in the container below. */
export function DiffTileContentView({
  summary,
  peekTarget,
  expandedCommitIds,
  currentBody,
  onToggleCommit,
  onOpenPeek,
  onBack
}: DiffTileContentViewProps): React.JSX.Element {
  if (summary && peekTarget) {
    return (
      <DiffPeek
        summary={summary}
        target={peekTarget}
        currentBody={currentBody}
        onBack={onBack}
        onNavigate={onOpenPeek}
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
  const summary = useChatSession((state) => state.gitSnapshot.summary)
  const peekTarget = useChatSession((state) => state.gitSnapshot.peekTarget)
  const expandedCommitIds = useChatSession((state) => state.gitSnapshot.expandedCommitIds)
  const summaryGeneration = useChatSession((state) => state.gitSnapshotRequest?.generation ?? 0)
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
    bodyOwner.run(
      bodyKey,
      () => gitApi.diffFile(diffPeekFileRequest(cwd, sessionId, peekTarget)),
      (request, content) => setBody({ ...request, content }),
      (request) => setBody({ ...request, content: { kind: 'unavailable', reason: 'error' } })
    )
  }, [body?.key, bodyKey, bodyOwner, cwd, peekTarget, sessionId])

  return (
    <DiffTileContentView
      summary={summary}
      peekTarget={peekTarget}
      expandedCommitIds={new Set(expandedCommitIds)}
      currentBody={currentBody}
      onToggleCommit={chatActions.toggleGitSnapshotCommitExpanded}
      onOpenPeek={chatActions.openGitSnapshotPeek}
      onBack={chatActions.closeGitSnapshotPeek}
    />
  )
}
