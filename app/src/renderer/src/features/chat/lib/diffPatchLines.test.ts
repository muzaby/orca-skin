// 0211 ΔV4 r2 — 패치 줄 → `DiffLine` 변환의 **축 계약**(D9).
//
// r1 검증에서 `oldLine` 과 `newLine` 을 맞바꿔도 924케이스가 전건 green 이었다: 이 모듈에
// 테스트가 없었고, 거터가 읽는 `lineNo` 는 두 축 중 살아남은 쪽으로 접혀 화면이 같아 보였다.
//
// 잠그는 것은 **어느 줄이 어느 축을 갖는가** 다 — removed 는 old 축에만, added 는 new 축에만,
// unchanged 는 둘 다. 이 규약은 도구 카드(`DiffBody`)와 공유하는 `diffLines.ts` 가 정한다.

import { describe, expect, it } from 'vitest'
import type { GitDiffPatchLine } from '../../../../../shared/ipc'
import { patchLinesToDiffLines } from './diffPatchLines'

const lines: GitDiffPatchLine[] = [
  { type: 'unchanged', oldLine: 10, newLine: 20, text: 'ctx' },
  { type: 'removed', oldLine: 11, newLine: null, text: 'before' },
  { type: 'added', oldLine: null, newLine: 21, text: 'after' }
]

describe('patchLinesToDiffLines — 두 축은 서로를 대신하지 못한다', () => {
  it('세 종류가 각자의 축만 갖는다', () => {
    expect(patchLinesToDiffLines(lines)).toEqual([
      { type: 'unchanged', oldLine: 10, newLine: 20, lineNo: 20, text: 'ctx' },
      { type: 'removed', oldLine: 11, newLine: null, lineNo: 11, text: 'before' },
      { type: 'added', oldLine: null, newLine: 21, lineNo: 21, text: 'after' }
    ])
  })

  it('거터 번호는 removed 만 old 축이다 — 두 축을 맞바꾸면 여기가 갈린다', () => {
    const converted = patchLinesToDiffLines(lines)

    expect(converted.map((line) => line.lineNo)).toEqual([20, 11, 21])
    // 축을 맞바꾼 구현은 removed 의 `lineNo` 가 `null ?? 0` 을 지나 **0** 이 된다.
    expect(converted[1].lineNo).not.toBe(0)
  })

  it('두 축이 모두 비면 0 으로 접는다 — undefined 를 화면에 흘리지 않는다', () => {
    expect(
      patchLinesToDiffLines([{ type: 'added', oldLine: null, newLine: null, text: 'x' }])[0].lineNo
    ).toBe(0)
  })

  it('빈 배열은 빈 배열이다 — 상한 초과 파일(kind: too-large)이 이 입력이다', () => {
    expect(patchLinesToDiffLines([])).toEqual([])
  })
})
