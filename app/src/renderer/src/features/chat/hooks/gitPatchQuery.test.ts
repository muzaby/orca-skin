// 0211 ΔV4 — 패치 조회 계기 (VP-54 · AT-46 · EP-34).
//
// **양방향으로 잠근다.** "증가 0" 만 세면 조회를 통째로 지운 구현이 통과하므로(AT-20·AT-32 와
// 같은 축), 조회해야 하는 세 자리(첫 열기 · 턴 종료 뒤 · 새로고침 뒤)를 같은 스위트에서 함께
// 단언한다. 세대 경계에서 `patch` 를 비우는 쪽은 `chatReducer.plan.test.ts` 가 잠근다.

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import type { GitDiffPatch } from '../../../../../shared/ipc'
import { walkSourceFiles } from '../../../shared/ui/sourceScan.testlib'
import { gitPatchRequest, shouldFetchGitPatch } from './useGitPatch'

const request = { key: JSON.stringify(['/repo', 's1']), generation: 3 }

function patchWith(files: number): GitDiffPatch {
  return {
    isRepo: true,
    base: { kind: 'worktree-base', oid: 'b', ref: 'main' },
    files: Array.from({ length: files }, (_, index) => ({
      path: `f${index}.ts`,
      status: 'modified' as const,
      added: 1,
      removed: 0,
      kind: 'text' as const,
      lines: []
    })),
    filesTruncated: false,
    contextLimited: false,
    unavailable: false
  }
}

describe('조회 계기 — 세대당 1회', () => {
  it('그 세대의 패치가 없으면 조회한다 (첫 열기 · 턴 종료 뒤 · 새로고침 뒤)', () => {
    expect(shouldFetchGitPatch({ cwd: '/repo', patch: null, request })).toBe(true)
  })

  it('이미 받았으면 조회하지 않는다 — 타일을 닫았다 열어도 증가가 0이다', () => {
    expect(shouldFetchGitPatch({ cwd: '/repo', patch: patchWith(1), request })).toBe(false)
  })

  it('파일 수는 판정에 들어가지 않는다 — 40파일도 1파일과 같다', () => {
    expect(shouldFetchGitPatch({ cwd: '/repo', patch: patchWith(40), request })).toBe(false)
    expect(shouldFetchGitPatch({ cwd: '/repo', patch: patchWith(1), request })).toBe(false)
  })

  it('요약 세대가 아직 없으면 조회하지 않는다 — 무엇 대비인지 모른 채 묻지 않는다', () => {
    expect(shouldFetchGitPatch({ cwd: '/repo', patch: null, request: null })).toBe(false)
  })

  it('저장소 좌표가 없으면 조회하지 않는다', () => {
    expect(shouldFetchGitPatch({ cwd: null, patch: null, request })).toBe(false)
  })
})

describe('조회 인자 — 파일 축도 커밋 축도 없다', () => {
  it('세션이 있으면 cwd + sessionId 둘뿐이다', () => {
    expect(gitPatchRequest('/repo', 's1')).toEqual({ cwd: '/repo', sessionId: 's1' })
  })

  it('랜딩(세션 이전)은 cwd 하나다 — 빈 sessionId 를 실어 보내지 않는다', () => {
    expect(gitPatchRequest('/repo', null)).toEqual({ cwd: '/repo' })
  })
})

describe('소유자는 하나다 (EP-34 ③)', () => {
  const RENDERER = fileURLToPath(new URL('../../../..', import.meta.url))

  // 전수는 `walkSourceFiles` 로 훑는다 — **경로를 값으로 비교**하는 술어라 구분자가 하나여야
  // 한다(0208 D-021). `globSync` 는 Windows 에서 `src\features\…` 를 돌려줘 같은 코드가
  // Linux 초록 · Windows 빨강이 됐다: 그 red 는 회귀가 아니라 술어가 실행 OS 를 본 것이다.
  const sources = (): string[] =>
    walkSourceFiles(RENDERER).filter((file) => !file.includes('.test.'))

  it('gitApi.diffPatch 를 부르는 renderer 프로덕션 파일이 1개다', () => {
    const files = sources().filter((file) =>
      /gitApi\s*\.\s*diffPatch\s*\(/.test(readFileSync(`${RENDERER}${file}`, 'utf8'))
    )

    expect(files).toEqual(['src/features/chat/hooks/useGitPatch.ts'])
  })

  it('useGitPatch 를 부르는 곳은 타일 컨테이너 하나다 — 닫히면 조회가 0이다', () => {
    const files = sources()
      .filter((file) => !file.endsWith('useGitPatch.ts'))
      .filter((file) => /useGitPatch\s*\(/.test(readFileSync(`${RENDERER}${file}`, 'utf8')))

    expect(files).toEqual(['src/features/chat/components/rightpanel/DiffTileContent.tsx'])
  })
})
