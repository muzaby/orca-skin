import { useEffect, useRef, useState } from 'react'
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

// 역할은 요청 identity 와 다르지만(이쪽은 effect 트리거) **좌표는 같다** — 계산을 두 벌로
// 두면 한쪽만 바뀌었을 때 두 테스트가 각자 green 인 채로 갈린다.
export function gitSnapshotTriggerKey(cwd: string | null, sessionId: string | null): string {
  return gitSnapshotRequestKey(cwd, sessionId)
}

interface GitSnapshotQueryOwner {
  run<T>(
    key: string,
    load: () => Promise<T>,
    onStart: (request: GitSnapshotRequest) => void,
    onResult: (request: GitSnapshotRequest, summary: T) => void,
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

interface SnapshotQueryPoint {
  statusKey: string
  summaryKey: string
  tick: number
  refreshTick: number
}

export function planGitSnapshotQuery(
  previous: SnapshotQueryPoint | null,
  next: SnapshotQueryPoint
): { includeSummary: boolean } | null {
  if (!previous || previous.statusKey !== next.statusKey) return { includeSummary: false }
  if (previous.summaryKey !== next.summaryKey) return null
  if (next.tick > previous.tick || next.refreshTick > previous.refreshTick)
    return { includeSummary: true }
  return null
}

// One owner rejects late status and summary together.
export function useGitSnapshot(cwd: string | null, sessionId: string | null): void {
  const tick = useChatSession(turnEndTick)
  const refreshTick = useChatSession((state) => state.gitRefreshTick)
  const previous = useRef<SnapshotQueryPoint | null>(null)
  const pendingStatus = useRef<{
    cwd: string
    promise: ReturnType<typeof gitApi.snapshot>
  } | null>(null)
  const [owner] = useState(createGitSnapshotQueryOwner)
  const statusKey = gitStatusTriggerKey(cwd)
  const summaryKey = gitSnapshotTriggerKey(cwd, sessionId)
  useEffect(() => {
    const next = { statusKey, summaryKey, tick, refreshTick }
    const query = planGitSnapshotQuery(previous.current, next)
    previous.current = next
    if (!cwd) return undefined
    // Status belongs to cwd. A session switch cancels the old owner, but can
    // attach the new owner to the same pending status-only request.
    const reusable = pendingStatus.current?.cwd === cwd ? pendingStatus.current : null
    if (!query && !reusable) return undefined
    const includeSummary = query?.includeSummary ?? false
    let promise: ReturnType<typeof gitApi.snapshot>
    if (!query && reusable) {
      promise = reusable.promise
    } else {
      pendingStatus.current = null
      promise = gitApi.snapshot({
        cwd,
        ...(sessionId ? { sessionId } : {}),
        includeSummary
      })
      if (!includeSummary) {
        const pending = { cwd, promise }
        pending.promise = promise.finally(() => {
          if (pendingStatus.current === pending) pendingStatus.current = null
        })
        pendingStatus.current = pending
        promise = pending.promise
      }
    }
    return owner.run(
      summaryKey,
      () => promise,
      (request) => {
        if (includeSummary) chatActions.beginGitSnapshotQuery(request)
      },
      (request, result) => {
        chatActions.setGitStatus({ cwd, status: result.status })
        if (includeSummary) {
          if (result.summary) chatActions.receiveGitSnapshotSummary(request, result.summary)
          else chatActions.failGitSnapshotQuery(request, 'summary')
        }
      },
      (request) => {
        chatActions.setGitStatus({ cwd, status: null })
        if (includeSummary) chatActions.failGitSnapshotQuery(request, 'summary')
      }
    )
  }, [cwd, sessionId, owner, tick, refreshTick, statusKey, summaryKey])
}
