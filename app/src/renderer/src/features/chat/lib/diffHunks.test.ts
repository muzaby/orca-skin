import { describe, expect, it } from 'vitest'
import type { DiffLine } from './diffLines'
import { buildDiffHunks, expandGap } from './diffHunks'

function twoChangeLines(): DiffLine[] {
  return Array.from({ length: 200 }, (_, index) => {
    const line = index + 1
    const changed = line === 50 || line === 150
    return {
      type: changed ? 'added' : 'unchanged',
      lineNo: line,
      oldLine: changed ? null : line,
      newLine: line,
      text: `line ${line}`
    }
  })
}

describe('diff hunk derivation', () => {
  it('두 변경의 200행 입력은 두 hunk와 세 gap으로 시작한다', () => {
    const state = buildDiffHunks(twoChangeLines(), 3)

    expect(state.hunks).toHaveLength(2)
    expect(state.rows.filter((row) => row.kind === 'gap')).toHaveLength(3)
  })

  it('gap을 위쪽으로 5행만 넓히면 그 gap만 바뀌고 기존 행 키/순서는 보존한다', () => {
    const initial = buildDiffHunks(twoChangeLines(), 3)
    const gap = initial.rows.find((row) => row.kind === 'gap')
    if (!gap || gap.kind !== 'gap') throw new Error('expected leading gap')
    const originalKeys = initial.rows.filter((row) => row.kind === 'line').map((row) => row.id)

    const expanded = expandGap(initial, gap.id, 5)

    expect(expanded.insertedAbove).toBe(5)
    expect(expanded.state.rows.filter((row) => row.kind === 'gap')).toHaveLength(3)
    expect(expanded.state.rows.filter((row) => row.kind === 'line').map((row) => row.id)).toEqual(
      expect.arrayContaining(originalKeys)
    )
    const afterKeys = expanded.state.rows.filter((row) => row.kind === 'line').map((row) => row.id)
    expect(afterKeys.filter((id) => originalKeys.includes(id))).toEqual(originalKeys)
  })

  it('마지막 남은 gap을 파일 경계까지 넓히면 gap 자체가 사라진다', () => {
    const initial = buildDiffHunks(twoChangeLines(), 3)
    const tail = [...initial.rows].reverse().find((row) => row.kind === 'gap')
    if (!tail || tail.kind !== 'gap') throw new Error('expected trailing gap')

    const expanded = expandGap(initial, tail.id, 10_000)

    expect(expanded.state.rows.some((row) => row.id === tail.id)).toBe(false)
    expect(expanded.state.rows.filter((row) => row.kind === 'gap')).toHaveLength(2)
  })

  it('파일 끝 gap 확장은 보정할 다음 hunk가 없으므로 insertedAbove를 0으로 낸다', () => {
    const initial = buildDiffHunks(twoChangeLines(), 3)
    const tail = [...initial.rows].reverse().find((row) => row.kind === 'gap')
    if (!tail || tail.kind !== 'gap') throw new Error('expected trailing gap')

    const expanded = expandGap(initial, tail.id, 5)

    expect(expanded.insertedAbove).toBe(0)
  })
})
