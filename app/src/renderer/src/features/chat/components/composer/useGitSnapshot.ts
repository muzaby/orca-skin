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
  sessionId: string | null
): string {
  return JSON.stringify([cwd, sessionId])
}

// 상태 조회의 identity — 선택 커밋은 이미 받은 session summary 안에서만 고른다.
// 브랜치·저장소 루트가 바뀌는 사건이 아니다.
export function gitStatusTriggerKey(cwd: string | null, refreshGeneration: number): string {
  return JSON.stringify([cwd, refreshGeneration])
}

export function gitSnapshotTriggerKey(
  cwd: string | null,
  sessionId: string | null,
  refreshGeneration: number
): string {
  return JSON.stringify([cwd, sessionId, refreshGeneration])
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
//
// **`gitApi.status` 와 `gitApi.diffSummary` 를 함께 소유한다**(0211 ΔV1 D-031, §10 EP-13).
// 소유자가 둘이면 계기를 줄여도 한쪽만 줄어든다 — 컴포저 행이 자기 effect 로 상태를 부르던
// 자리가 그것이었다. 두 조회는 identity 가 다르므로(상태는 커밋을 보지 않는다) effect 를
// 나누되 같은 순수 판정(`gitSnapshotQueryReason`)을 쓴다.
export function useGitSnapshot(cwd: string | null, sessionId: string | null): void {
  const busy = useChatSession(sessionBusy)
  const refreshGeneration = useChatSession((s) => s.gitSnapshot.refreshGeneration)
  const previousQueryPoint = useRef<GitSnapshotQueryPoint | null>(null)
  const previousStatusPoint = useRef<GitSnapshotQueryPoint | null>(null)
  const [owner] = useState(createGitSnapshotQueryOwner)

  const runStatusQuery = useCallback(() => {
    if (!cwd) return undefined
    let live = true
    void gitApi
      .status(cwd)
      .then((status) => {
        if (live) chatActions.setGitStatus({ cwd, status })
      })
      .catch(() => {
        if (live) chatActions.setGitStatus({ cwd, status: null })
      })
    return () => {
      live = false
    }
  }, [cwd])

  const runQuery = useCallback(() => {
    if (!cwd) return undefined
    const key = gitSnapshotRequestKey(cwd, sessionId)
    return owner.run(
      key,
      () =>
        gitApi.diffSummary({
          cwd,
          ...(sessionId ? { sessionId } : {})
        }),
      chatActions.beginGitSnapshotQuery,
      chatActions.receiveGitSnapshotSummary
    )
  }, [cwd, owner, sessionId])

  const triggerKey = gitSnapshotTriggerKey(cwd, sessionId, refreshGeneration)
  useEffect(() => {
    const next = { identity: triggerKey, busy }
    const reason = gitSnapshotQueryReason(previousQueryPoint.current, next)
    previousQueryPoint.current = next
    if (reason) return runQuery()
    return undefined
  }, [busy, runQuery, triggerKey])

  const statusKey = gitStatusTriggerKey(cwd, refreshGeneration)
  useEffect(() => {
    const next = { identity: statusKey, busy }
    const reason = gitSnapshotQueryReason(previousStatusPoint.current, next)
    previousStatusPoint.current = next
    if (reason) return runStatusQuery()
    return undefined
  }, [busy, runStatusQuery, statusKey])
}
