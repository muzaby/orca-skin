import { useCallback, useEffect, useRef, useState } from 'react'
import type { GitDiffSummary } from '../../../../../../shared/ipc'
import { gitApi } from '../../../../shared/api/ipc'
import type { GitSnapshotRequest } from '../../reducer/chatReducer'
import { chatActions, turnEndTick, useChatSession } from '../../store/chatStore'

interface GitSnapshotQueryPoint {
  identity: string
  tick: number
  refreshTick?: number
}

// 저장소·브랜치 **이름** 조회의 계기 (0211 ΔV5 D-101, §10 EP-42).
//
// 이름은 세션의 식별이지 에이전트 작업의 산출이 아니다. 이것까지 턴 종료에 묶으면 앱을 다시
// 켠 세션에서 `gitRowView` 가 `status?.isRepo` 를 못 읽어 컴포저 git 행이 **통째로 사라진다**.
export function gitStatusQueryReason(
  previous: GitSnapshotQueryPoint | null,
  next: GitSnapshotQueryPoint
): 'initial' | 'identity' | 'turn-end' | 'manual' | null {
  if (!previous) return 'initial'
  if (previous.identity !== next.identity) return 'identity'
  if ((next.refreshTick ?? 0) > (previous.refreshTick ?? 0)) return 'manual'
  return next.tick > previous.tick ? 'turn-end' : null
}

// 변경 목록은 Stop hook의 턴 종료 또는 명시적인 새로 고침 때 조회한다.
// 마운트/세션 전환 자체는 조회하지 않으며, 다른 세션의 카운터 증가를 계기로 쓰지 않는다.
export function gitSummaryQueryReason(
  previous: { tick: number; refreshTick?: number; identity?: string } | null,
  next: { tick: number; refreshTick?: number; identity?: string }
): 'turn-end' | 'manual' | null {
  if (!previous) return null
  if (previous.identity !== next.identity) return null
  if ((next.refreshTick ?? 0) > (previous.refreshTick ?? 0)) return 'manual'
  return next.tick > previous.tick ? 'turn-end' : null
}

export function gitSnapshotRequestKey(cwd: string | null, sessionId: string | null): string {
  return JSON.stringify([cwd, sessionId])
}

// 상태 조회의 identity — 선택 커밋은 이미 받은 session summary 안에서만 고른다.
// 브랜치·저장소 루트가 바뀌는 사건이 아니다.
export function gitStatusTriggerKey(cwd: string | null): string {
  return JSON.stringify([cwd])
}

export function gitSnapshotTriggerKey(cwd: string | null, sessionId: string | null): string {
  return JSON.stringify([cwd, sessionId])
}

interface GitSnapshotQueryOwner {
  run(
    key: string,
    load: () => Promise<GitDiffSummary>,
    onStart: (request: GitSnapshotRequest) => void,
    onResult: (request: GitSnapshotRequest, summary: GitDiffSummary) => void,
    onError?: (request: GitSnapshotRequest) => void
  ): () => void
}

// 세션 store와 같은 renderer 수명으로 발급해 화면 재마운트의 번호 충돌을 막는다.
let nextGitSnapshotGeneration = 0

export function createGitSnapshotQueryOwner(): GitSnapshotQueryOwner {
  let generation = 0
  return {
    run(key, load, onStart, onResult, onError) {
      const request = { key, generation: ++nextGitSnapshotGeneration }
      generation = request.generation
      let live = true
      onStart(request)
      void load()
        .then((summary) => {
          if (live && request.generation === generation) onResult(request, summary)
        })
        .catch(() => {
          if (live && request.generation === generation) onError?.(request)
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
// 자리가 그것이었다. **소유자는 하나지만 계기는 둘로 갈린다**(0211 ΔV5 D-099·D-101): 이름은
// 초기 이름 조회와 목록 조회를 분리하고 수동 새로 고침은 둘 다 갱신한다.
export function useGitSnapshot(cwd: string | null, sessionId: string | null): void {
  // 자동 계기는 Stop hook의 tick이다. 수동 계기는 별도 세션 카운터를 쓴다.
  const tick = useChatSession(turnEndTick)
  const refreshTick = useChatSession((state) => state.gitRefreshTick)
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
      chatActions.receiveGitSnapshotSummary,
      (request) => chatActions.failGitSnapshotQuery(request, 'summary')
    )
  }, [cwd, owner, sessionId])

  // 좌표가 바뀌면 다음 턴 종료가 **새 키로** 조회해야 하므로 deps 에 남긴다 — 계기 판정만
  // tick과 명시적 refresh만 본다(키 변화 자체는 조회를 만들지 않는다).
  const triggerKey = gitSnapshotTriggerKey(cwd, sessionId)
  useEffect(() => {
    const next = { identity: triggerKey, tick, refreshTick }
    const reason = gitSummaryQueryReason(previousQueryPoint.current, next)
    previousQueryPoint.current = next
    if (reason) return runQuery()
    return undefined
  }, [tick, refreshTick, runQuery, triggerKey])

  const statusKey = gitStatusTriggerKey(cwd)
  useEffect(() => {
    const next = { identity: statusKey, tick, refreshTick }
    const reason = gitStatusQueryReason(previousStatusPoint.current, next)
    previousStatusPoint.current = next
    if (reason) return runStatusQuery()
    return undefined
  }, [tick, refreshTick, runStatusQuery, statusKey])
}
