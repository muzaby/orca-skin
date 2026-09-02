import { useEffect, useRef } from 'react'
import type { GitDiffPatch, GitDiffPatchRequest } from '../../../../../shared/ipc'
import { gitApi } from '../../../shared/api/ipc'
import type { GitSnapshotRequest } from '../reducer/chatReducer'
import { chatActions, useChatSession, useChatStore } from '../store/chatStore'

/**
 * 패치를 지금 조회해야 하는가 — **순수 판정** (0211 ΔV4 D-078, §10 EP-34 ①).
 *
 * 조건은 하나다: 저장소 좌표가 있고, 요약 세대가 정해졌고, **그 세대의 패치가 아직 없다**.
 * `patch !== null` 이면 같은 세대를 다시 묻지 않으므로 타일을 닫았다 열어도 증가가 0이다.
 *
 * 판정을 훅 밖에 두는 이유: vitest 가 `environment: 'node'` 라 effect 를 돌릴 수 없다 —
 * 계기를 렌더로 세면 그 축은 자동 oracle 이 없다. 여기서는 규칙 자체를 잰다.
 */
export function shouldFetchGitPatch(input: {
  cwd: string | null
  patch: GitDiffPatch | null
  request: GitSnapshotRequest | null
}): boolean {
  return input.cwd !== null && input.request !== null && input.patch === null
}

/**
 * 조회 인자 — **파일 축이 없다**(D-074). 그래서 호출 수가 파일 수와 무관하다.
 * 커밋 축도 없다(D-036·D-079): 커밋 선택은 표시 목록을 좁히는 renderer 축이다.
 */
export function gitPatchRequest(cwd: string, sessionId: string | null): GitDiffPatchRequest {
  return { cwd, ...(sessionId ? { sessionId } : {}) }
}

/**
 * 패치 조회 소유자 (§10 EP-34 ③ — `gitApi.diffPatch` 를 부르는 renderer 파일은 여기 하나다).
 *
 * **이 훅은 타일 컨테이너 안에서만 돈다.** 타일이 닫히면 언마운트라 조회가 0이고, 요약
 * (`useGitSnapshot`)은 컴포저 git 행도 읽으므로 무거운 패치를 거기 실으면 타일을 열지 않아도
 * 매 턴 비용을 낸다.
 */
export function useGitPatch(): void {
  const cwd = useChatSession((state) => state.cwd)
  const sessionId = useChatSession((state) => state.sessionId)
  const sessionKey = useChatStore((state) => state.activeKey)
  const patch = useChatSession((state) => state.gitSnapshot.patch)
  const request = useChatSession((state) => state.gitSnapshotRequest)
  // 진행 중 요청 키. 응답을 기다리는 동안의 재렌더가 두 번째 조회를 만들지 않게 한다.
  const inFlight = useRef<string | null>(null)

  useEffect(() => {
    if (!cwd || !request || !shouldFetchGitPatch({ cwd, patch, request })) return
    const key = `${sessionKey}:${request.key}:${request.generation}`
    if (inFlight.current === key) return
    inFlight.current = key
    let live = true
    void gitApi
      .diffPatch(gitPatchRequest(cwd, sessionId))
      .then((result) => {
        // 늦게 도착한 응답은 리듀서의 세대 판정이 한 번 더 거른다 — 여기서 버리는 것은
        // 언마운트된 타일의 dispatch 뿐이다.
        if (live) chatActions.receiveGitPatch(request, result)
      })
      .catch(() => {
        // 실패는 다음 계기(턴 종료·새로고침)가 재시도한다. `patch` 가 null 로 남아 화면은
        // 로딩 문구를 유지하고, 조용히 "변경 없음" 으로 바뀌지 않는다.
        if (live) inFlight.current = null
      })
    return () => {
      live = false
    }
  }, [cwd, patch, request, sessionId, sessionKey])
}
