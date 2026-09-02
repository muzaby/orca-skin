import { describe, expect, it } from 'vitest'
import type { DiffLine } from './diffLines'
import { buildDiffHunks, expandGap } from './diffHunks'

function diffLine(type: DiffLine['type'], line: number, text: string): DiffLine {
  return {
    type,
    lineNo: line,
    oldLine: type === 'added' ? null : line,
    newLine: line,
    text
  }
}

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

// ── 양방향 문맥 확장 (0211 ΔV4 VP-56 · AT-48 · D-090) ────────────────────────
//
// 방향은 **줄 수 증가로 관측되지 않는다** — 두 방향 다 n 줄을 늘린다. 관측값은 두 가지다:
// 드러난 구간의 위치와 `insertedAbove`(위=n, 아래=0). 그래서 두 축을 함께 단언한다.

describe('expandGap 방향 (AT-48)', () => {
  const lines = Array.from({ length: 60 }, (_, index) =>
    diffLine(index === 30 ? 'added' : 'unchanged', index + 1, `l${index + 1}`)
  )

  it('선두 gap 은 위로만, 말미 gap 은 아래로만 펼칠 수 있다', () => {
    const state = buildDiffHunks(lines, 3)
    const gaps = state.rows.filter((row) => row.kind === 'gap')

    expect(gaps).toHaveLength(2)
    expect(gaps[0]).toMatchObject({ canUp: true, canDown: false })
    expect(gaps[1]).toMatchObject({ canUp: false, canDown: true })
  })

  it('위 확장은 gap 의 끝쪽을 열고 insertedAbove 로 그 수를 알린다', () => {
    const state = buildDiffHunks(lines, 3)
    const gap = state.rows.find((row) => row.kind === 'gap')!
    const result = expandGap(state, gap.id, 5, 'up')

    // 다음 hunk 바로 위 5줄이 드러난다 — 첫 gap 은 [0,27) 이므로 22~26 이다.
    const revealed = result.state.rows
      .filter((row) => row.kind === 'line' && row.sourceIndex < 27)
      .map((row) => (row.kind === 'line' ? row.sourceIndex : -1))
    expect(revealed).toEqual([22, 23, 24, 25, 26])
    expect(result.insertedAbove).toBe(5)
  })

  it('아래 확장은 gap 의 앞쪽을 열고 insertedAbove 가 0 이다 — 방향의 유일한 관측값이다', () => {
    const state = buildDiffHunks(lines, 3)
    const tail = [...state.rows].reverse().find((row) => row.kind === 'gap')!
    const result = expandGap(state, tail.id, 5, 'down')

    // 말미 gap 은 [34,60) 이므로 앞쪽 34~38 이 드러난다.
    const revealed = result.state.rows
      .filter((row) => row.kind === 'line' && row.sourceIndex >= 34)
      .map((row) => (row.kind === 'line' ? row.sourceIndex : -1))
    expect(revealed).toEqual([34, 35, 36, 37, 38])
    expect(result.insertedAbove).toBe(0)
  })

  it('두 방향 모두 기존 행의 키와 순서를 보존한다 (D-058 ①)', () => {
    const state = buildDiffHunks(lines, 3)
    const before = state.rows.flatMap((row) => (row.kind === 'line' ? [row.id] : []))
    for (const direction of ['up', 'down'] as const) {
      const gap = state.rows.find(
        (row) => row.kind === 'gap' && (direction === 'up' ? row.canUp : row.canDown)
      )!
      const after = expandGap(state, gap.id, 5, direction).state.rows.flatMap((row) =>
        row.kind === 'line' ? [row.id] : []
      )
      let cursor = 0
      for (const id of before) {
        cursor = after.indexOf(id, cursor)
        expect(cursor).toBeGreaterThanOrEqual(0)
      }
    }
  })

  it('남은 줄이 요청보다 적으면 gap 이 사라진다', () => {
    const short = Array.from({ length: 8 }, (_, index) =>
      diffLine(index === 7 ? 'added' : 'unchanged', index + 1, `s${index}`)
    )
    const state = buildDiffHunks(short, 1)
    const gap = state.rows.find((row) => row.kind === 'gap')!
    const result = expandGap(state, gap.id, 20, 'up')

    expect(result.state.rows.some((row) => row.kind === 'gap')).toBe(false)
  })

  it('중간 gap 은 양방향 후보를 모두 갖는다', () => {
    const twoHunks = Array.from({ length: 60 }, (_, index) =>
      diffLine(index === 10 || index === 45 ? 'added' : 'unchanged', index + 1, `m${index}`)
    )
    const state = buildDiffHunks(twoHunks, 2)
    const middle = state.rows.filter((row) => row.kind === 'gap')[1]

    expect(middle).toMatchObject({ canUp: true, canDown: true })
  })
})
