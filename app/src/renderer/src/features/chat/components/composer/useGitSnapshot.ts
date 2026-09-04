import { useCallback, useEffect, useRef, useState } from 'react'
import type { GitDiffSummary } from '../../../../../../shared/ipc'
import { gitApi } from '../../../../shared/api/ipc'
import type { GitSnapshotRequest } from '../../reducer/chatReducer'
import { chatActions, turnEndTick, useChatSession } from '../../store/chatStore'

interface GitSnapshotQueryPoint {
  identity: string
  tick: number
}

// 저장소·브랜치 **이름** 조회의 계기 (0211 ΔV5 D-101, §10 EP-42).
//
// 이름은 세션의 식별이지 에이전트 작업의 산출이 아니다. 이것까지 턴 종료에 묶으면 앱을 다시
// 켠 세션에서 `gitRowView` 가 `status?.isRepo` 를 못 읽어 컴포저 git 행이 **통째로 사라진다**.
export function gitStatusQueryReason(
  previous: GitSnapshotQueryPoint | null,
  next: GitSnapshotQueryPoint
): 'initial' | 'identity' | 'turn-end' | null {
  if (!previous) return 'initial'
  if (previous.identity !== next.identity) return 'identity'
  return next.tick > previous.tick ? 'turn-end' : null
}

// 변경 **목록** 조회의 계기 — **턴 종료 하나** (0211 ΔV5 D-099 · ΔV6 D-115, §10 EP-42).
//
// 사용자 결정: “외부 변경이 있더라도 실시간 동기화하지 않는다. 오직 에이전트 메시지 턴
// 반환시 싱크한다.” 그래서 마운트도 세션 전환도 계기가 아니다 — `previous` 가 없으면 `null`
// 이고, 그 세션에서 턴이 한 번 끝나야 목록이 선다(그 전 화면은 D-102 의 미싱크 문구다).
//
// **ΔV6 — 그 “턴 종료” 의 출처가 바뀌었다.** 이제 `busy` 전이가 아니라 백엔드 Stop hook 이
// 낸 `turn.ended` 를 센 `turnEndTick` 이다. `busy` 는 `result` 메시지가 만드는 파생이라
// 사용자가 지목한 자리였다(“어시스턴트 메시지 (result )가 아닌 stop 훅”). 두 값이 대개 같은
// 순간에 움직여도 **출처가 다르고**, 그 차이가 이 함수의 계약이다.
//
// 두 함수가 **서로 다른 값**을 낸다는 것이 D-101 의 oracle 이다. 하나로 합치면 이름 축이
// 함께 늦어지거나 목록 축이 함께 빨라져 둘 중 하나의 계약이 조용히 깨진다.
export function gitSummaryQueryReason(
  previous: { tick: number } | null,
  next: { tick: number }
): 'turn-end' | null {
  if (!previous) return null
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
    onResult: (request: GitSnapshotRequest, summary: GitDiffSummary) => void
  ): () => void
}

// 세션 store와 같은 renderer 수명으로 발급해 화면 재마운트의 번호 충돌을 막는다.
let nextGitSnapshotGeneration = 0

export function createGitSnapshotQueryOwner(): GitSnapshotQueryOwner {
  let generation = 0
  return {
    run(key, load, onStart, onResult) {
      const request = { key, generation: ++nextGitSnapshotGeneration }
      generation = request.generation
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
// 자리가 그것이었다. **소유자는 하나지만 계기는 둘로 갈린다**(0211 ΔV5 D-099·D-101): 이름은
// 세 계기, 목록은 턴 종료 하나다.
export function useGitSnapshot(cwd: string | null, sessionId: string | null): void {
  // 계기의 유일한 입력이다 (0211 ΔV6 D-115) — `sessionBusy` 는 더 이상 읽지 않는다.
  const tick = useChatSession(turnEndTick)
  const previousQueryPoint = useRef<{ tick: number } | null>(null)
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

  // 좌표가 바뀌면 다음 턴 종료가 **새 키로** 조회해야 하므로 deps 에 남긴다 — 계기 판정만
  // tick 을 본다(키 변화 자체는 조회를 만들지 않는다).
  const triggerKey = gitSnapshotTriggerKey(cwd, sessionId)
  useEffect(() => {
    const next = { tick }
    const reason = gitSummaryQueryReason(previousQueryPoint.current, next)
    previousQueryPoint.current = next
    if (reason) return runQuery()
    return undefined
  }, [tick, runQuery, triggerKey])

  const statusKey = gitStatusTriggerKey(cwd)
  useEffect(() => {
    const next = { identity: statusKey, tick }
    const reason = gitStatusQueryReason(previousStatusPoint.current, next)
    previousStatusPoint.current = next
    if (reason) return runStatusQuery()
    return undefined
  }, [tick, runStatusQuery, statusKey])
}
