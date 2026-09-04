import { describe, expect, it } from 'vitest'
import { buildDiffHunks, revealDiffHunkLine } from './diffHunks'
import type { DiffLine } from './diffLines'

const lines: DiffLine[] = Array.from({ length: 100 }, (_, index) => ({
  type: index === 0 ? 'added' : 'unchanged',
  lineNo: index + 1,
  oldLine: index === 0 ? null : index + 1,
  newLine: index + 1,
  text: `line ${index + 1}`
}))

describe('선택 코멘트 문맥 표시', () => {
  it('큰 gap 중 선택 줄 주변만 펼치고 원래 행 identity를 보존한다', () => {
    const original = buildDiffHunks(lines, 3)
    const result = revealDiffHunkLine(original, 49, 3)
    expect(result.rows.filter((row) => row.kind === 'line').map((row) => row.sourceIndex)).toEqual([
      0, 1, 2, 3, 46, 47, 48, 49, 50, 51, 52
    ])
    expect(
      result.rows.filter((row) => row.kind === 'gap').map((row) => [row.start, row.end])
    ).toEqual([
      [4, 46],
      [53, 100]
    ])
    expect(result.rows[0]).toBe(original.rows[0])
  })

  it('이미 표시된 줄과 범위 밖 선택은 같은 상태를 돌려준다', () => {
    const state = buildDiffHunks(lines, 3)
    expect(revealDiffHunkLine(state, 0, 3)).toBe(state)
    expect(revealDiffHunkLine(state, -1, 3)).toBe(state)
    expect(revealDiffHunkLine(state, 100, 3)).toBe(state)
  })
})
