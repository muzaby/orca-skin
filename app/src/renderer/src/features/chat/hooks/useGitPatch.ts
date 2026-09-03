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

/** 진행 중 조회 하나를 기억하는 자리 (0211 ΔV5 MD-25). */
export interface PatchQueryGuard {
  inFlightKey: string | null
}

export const IDLE_PATCH_GUARD: PatchQueryGuard = { inFlightKey: null }

export function patchQueryKey(sessionKey: string, request: GitSnapshotRequest): string {
  return `${sessionKey}:${request.key}:${request.generation}`
}

/**
 * 조회를 시작할지와 그 다음 가드 상태 (0211 ΔV5 D-103, §10 EP-34 ④).
 *
 * 같은 키가 이미 나가 있으면 `false` — 응답을 기다리는 동안의 재렌더가 두 번째 조회를
 * 만들지 않게 한다.
 */
export function beginPatchQuery(
  guard: PatchQueryGuard,
  input: {
    cwd: string | null
    patch: GitDiffPatch | null
    request: GitSnapshotRequest | null
    sessionKey: string
  }
): { guard: PatchQueryGuard; fetch: boolean; key: string | null } {
  if (!input.request || !shouldFetchGitPatch(input)) return { guard, fetch: false, key: null }
  const key = patchQueryKey(input.sessionKey, input.request)
  if (guard.inFlightKey === key) return { guard, fetch: false, key }
  return { guard: { inFlightKey: key }, fetch: true, key }
}

/**
 * 응답이 도달했다 — **성공·실패·폐기 공통** (0211 ΔV5 D-103).
 *
 * 성공에서 해제하지 않으면 교착이 난다: 패치가 먼저 도착해 저장된 뒤 같은 세대의 요약이
 * 늦게 와서 `patch` 를 `null` 로 되돌리면, 요청 키가 그대로라 다음 렌더가 같은 키를 만들고
 * 가드가 그것을 막아 화면이 **영원히 로딩 문구**에 갇힌다. 커밋이 생긴 뒤 요약 경로에
 * `git log --raw --numstat` 이 붙어 요약이 패치보다 느려지는 것이 그 순서 역전의 원인이다.
 *
 * 키가 다르면 그대로 둔다 — 늦게 끝난 이전 조회가 방금 나간 새 조회의 가드를 풀지 않는다.
 */
export function settlePatchQuery(guard: PatchQueryGuard, key: string): PatchQueryGuard {
  return guard.inFlightKey === key ? IDLE_PATCH_GUARD : guard
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
  const guard = useRef<PatchQueryGuard>(IDLE_PATCH_GUARD)

  useEffect(() => {
    const next = beginPatchQuery(guard.current, { cwd, patch, request, sessionKey })
    guard.current = next.guard
    if (!next.fetch || !cwd || !request || next.key === null) return
    const key = next.key
    let live = true
    void gitApi
      .diffPatch(gitPatchRequest(cwd, sessionId))
      .then((result) => {
        // 늦게 도착한 응답은 리듀서의 세대 판정이 한 번 더 거른다. 리듀서가 버리든 받든
        // **가드는 반드시 풀린다** — 버려진 응답에서 풀지 않으면 그 세대가 영영 잠긴다.
        // **dispatch 보다 먼저 푼다**: 상태 갱신이 곧바로 이 effect 를 다시 돌리면 아직
        // 잠긴 가드가 재조회를 막아 같은 교착이 난다.
        guard.current = settlePatchQuery(guard.current, key)
        if (live) chatActions.receiveGitPatch(request, result)
      })
      .catch(() => {
        // 실패는 다음 계기(턴 종료)가 재시도한다. `patch` 가 null 로 남아 화면은 로딩 문구를
        // 유지하고, 조용히 "변경 없음" 으로 바뀌지 않는다.
        guard.current = settlePatchQuery(guard.current, key)
      })
    return () => {
      live = false
    }
  }, [cwd, patch, request, sessionId, sessionKey])
}
