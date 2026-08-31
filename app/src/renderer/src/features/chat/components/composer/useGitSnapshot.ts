import { useCallback, useEffect, useRef, useState } from 'react'
import type { GitDiffSummary } from '../../../../../../shared/ipc'
import { gitApi } from '../../../../shared/api/ipc'
import type { GitSnapshotRequest } from '../../reducer/chatReducer'
import { chatActions, sessionBusy, useChatSession } from '../../store/chatStore'

interface GitSnapshotQueryPoint {
  identity: string
  busy: boolean
}

export function gitSnapshotQueryReason(
  previous: GitSnapshotQueryPoint | null,
  next: GitSnapshotQueryPoint
): 'initial' | 'identity' | 'turn-end' | null {
  if (!previous) return 'initial'
  if (previous.identity !== next.identity) return 'identity'
  return previous.busy && !next.busy ? 'turn-end' : null
}

export function gitSnapshotRequestKey(
  cwd: string | null,
  sessionId: string | null,
  commit: string | null
): string {
  return JSON.stringify([cwd, sessionId, commit])
}

export function gitSnapshotTriggerKey(
  cwd: string | null,
  sessionId: string | null,
  commit: string | null,
  refreshGeneration: number
): string {
  return JSON.stringify([cwd, sessionId, commit, refreshGeneration])
}

interface GitSnapshotQueryOwner {
  run(
    key: string,
    load: () => Promise<GitDiffSummary>,
    onStart: (request: GitSnapshotRequest) => void,
    onResult: (request: GitSnapshotRequest, summary: GitDiffSummary) => void
  ): () => void
}

export function createGitSnapshotQueryOwner(): GitSnapshotQueryOwner {
  let generation = 0
  return {
    run(key, load, onStart, onResult) {
      const request = { key, generation: ++generation }
      let live = true
      onStart(request)
      void load()
        .then((summary) => {
          if (live && request.generation === generation) onResult(request, summary)
        })
        .catch(() => {
          /* 실패는 기존 요약 상태를 유지하고 다음 trigger가 재시도한다. */
        })
      return () => {
        live = false
      }
    }
  }
}

// diff 타일과 독립적인 세션 수명 query owner. 타일 open/remount는 이 hook의 입력이 아니다.
export function useGitSnapshot(cwd: string | null, sessionId: string | null): void {
  const busy = useChatSession(sessionBusy)
  const selectedCommit = useChatSession((s) => s.gitSnapshot.selectedCommit)
  const refreshGeneration = useChatSession((s) => s.gitSnapshot.refreshGeneration)
  const previousQueryPoint = useRef<GitSnapshotQueryPoint | null>(null)
  const [owner] = useState(createGitSnapshotQueryOwner)

  const runQuery = useCallback(() => {
    if (!cwd) return undefined
    const key = gitSnapshotRequestKey(cwd, sessionId, selectedCommit)
    return owner.run(
      key,
      () =>
        gitApi.diffSummary({
          cwd,
          ...(sessionId ? { sessionId } : {}),
          ...(selectedCommit ? { commit: selectedCommit } : {})
        }),
      chatActions.beginGitSnapshotQuery,
      chatActions.receiveGitSnapshotSummary
    )
  }, [cwd, owner, selectedCommit, sessionId])

  const triggerKey = gitSnapshotTriggerKey(cwd, sessionId, selectedCommit, refreshGeneration)
  useEffect(() => {
    const next = { identity: triggerKey, busy }
    const reason = gitSnapshotQueryReason(previousQueryPoint.current, next)
    previousQueryPoint.current = next
    if (reason) return runQuery()
    return undefined
  }, [busy, runQuery, triggerKey])
}
