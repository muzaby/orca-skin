// 0211 ΔV5 AT-64 / VP-65 — 패치 조회 가드의 **해제** (D-103 · §10 EP-34 ④).
//
// 사용자 보고: "커밋요구후에도 우측패널에서 내용을 불러오는중... 만출력한다."
//
// 원인은 배선 소멸이 아니라 **해제되지 않는 가드**였다. 패치가 먼저 도착해 저장된 뒤 같은
// 세대의 요약이 늦게 와서 `patch` 를 `null` 로 되돌리면, 요청 키가 그대로라 다음 렌더가 같은
// 키를 만들고 가드가 그것을 막는다. 커밋이 생겨야 요약 경로에 `git log --raw --numstat` 이
// 붙어(=`base.oid !== HEAD`) 요약이 패치보다 느려지므로 "커밋 이후" 에만 보였다.
//
// **세 단계를 한 케이스로 잰다.** 이 회귀의 형태가 "가드가 있다/없다" 가 아니라 "풀리지
// 않는다" 라, 두 번째 값만 보면 가드를 지운 변이가 red 가 되고 세 번째 값만 보면 가드를
// 통째로 지운 변이가 통과한다.

import { describe, expect, it } from 'vitest'
import type { GitDiffPatch } from '../../../../../shared/ipc'
import {
  IDLE_PATCH_GUARD,
  beginPatchQuery,
  patchQueryKey,
  settlePatchQuery,
  shouldFetchGitPatch
} from './useGitPatch'

const PATCH: GitDiffPatch = {
  isRepo: true,
  base: { kind: 'worktree-base', oid: 'base-oid', ref: 'main' },
  files: [],
  filesTruncated: false,
  contextLimited: false,
  unavailable: false
}

const REQUEST = { key: '["/repo","s1"]', generation: 1 }
const INPUT = {
  cwd: '/repo',
  patch: null as GitDiffPatch | null,
  request: REQUEST,
  sessionKey: 'k'
}

describe('패치 조회 가드', () => {
  it('요약이 패치보다 늦게 와도 다시 조회한다 — 세 단계', () => {
    // ① 첫 조회는 나간다.
    const first = beginPatchQuery(IDLE_PATCH_GUARD, INPUT)
    expect(first.fetch).toBe(true)

    // ② 응답을 기다리는 동안의 재렌더는 두 번째 조회를 만들지 않는다.
    const duplicate = beginPatchQuery(first.guard, INPUT)
    expect(duplicate.fetch).toBe(false)

    // ③ 응답이 도달해 가드가 풀린 뒤, 늦은 요약이 패치를 무효화하면 **다시 나간다**.
    //    이 값이 교착의 직접 부정이다.
    const settled = settlePatchQuery(first.guard, first.key as string)
    const again = beginPatchQuery(settled, INPUT)
    expect(again.fetch).toBe(true)
  })

  it('패치가 이미 있으면 같은 세대를 다시 묻지 않는다 (D-078 승계)', () => {
    const settled = settlePatchQuery(
      beginPatchQuery(IDLE_PATCH_GUARD, INPUT).guard,
      patchQueryKey('k', REQUEST)
    )

    expect(beginPatchQuery(settled, { ...INPUT, patch: PATCH }).fetch).toBe(false)
  })

  it('늦게 끝난 이전 조회가 방금 나간 새 조회의 가드를 풀지 않는다', () => {
    const started = beginPatchQuery(IDLE_PATCH_GUARD, {
      ...INPUT,
      request: { key: INPUT.request.key, generation: 2 }
    })
    const staleKey = patchQueryKey('k', REQUEST)

    expect(settlePatchQuery(started.guard, staleKey)).toBe(started.guard)
    expect(
      beginPatchQuery(started.guard, {
        ...INPUT,
        request: { key: INPUT.request.key, generation: 2 }
      }).fetch
    ).toBe(false)
  })

  it('좌표·요청이 없으면 조회하지 않는다', () => {
    expect(beginPatchQuery(IDLE_PATCH_GUARD, { ...INPUT, cwd: null }).fetch).toBe(false)
    expect(beginPatchQuery(IDLE_PATCH_GUARD, { ...INPUT, request: null }).fetch).toBe(false)
    expect(shouldFetchGitPatch({ cwd: '/repo', patch: null, request: REQUEST })).toBe(true)
  })

  it('키는 세션·요청·세대 셋을 함께 본다 — 하나만 달라도 다른 조회다', () => {
    const base = patchQueryKey('k', REQUEST)

    expect(patchQueryKey('k', REQUEST)).toBe(base)
    expect(patchQueryKey('other', REQUEST)).not.toBe(base)
    expect(patchQueryKey('k', { ...REQUEST, generation: 2 })).not.toBe(base)
    expect(patchQueryKey('k', { ...REQUEST, key: 'other' })).not.toBe(base)
  })
})
