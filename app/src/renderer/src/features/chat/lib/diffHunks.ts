import type { DiffLine } from './diffLines'

export interface DiffHunkLineRow {
  kind: 'line'
  /** 입력 배열 index 기반 키 — gap 확장 뒤에도 기존 행의 identity를 보존한다. */
  id: `line:${number}`
  sourceIndex: number
  line: DiffLine
}

export interface DiffHunkGapRow {
  kind: 'gap'
  /** `[start,end)` 는 아직 숨긴 원본 입력 구간이다. */
  id: `gap:${number}:${number}`
  start: number
  end: number
  /**
   * 이 gap 에서 **어느 방향으로 펼칠 수 있는가** (0211 ΔV4 D-090).
   * `up` = 아래 hunk 쪽(끝쪽) 줄을 드러낸다 · `down` = 위 hunk 쪽(앞쪽) 줄을 드러낸다.
   * 방향을 값으로 두지 않으면 파일 맨 위에서 "아래로 펼치기" 가 눌리고 아무 일도 안 일어난다.
   */
  canUp: boolean
  canDown: boolean
}

export type GapDirection = 'up' | 'down'

export type DiffHunkRow = DiffHunkLineRow | DiffHunkGapRow

export interface DiffHunk {
  id: `hunk:${number}`
  lines: readonly DiffHunkLineRow[]
}

export interface DiffHunkState {
  lines: readonly DiffLine[]
  rows: readonly DiffHunkRow[]
  hunks: readonly DiffHunk[]
}

export interface GapExpansion {
  state: DiffHunkState
  /**
   * 현재 보이는 hunk 위에 삽입된 행 수. 스크롤 소유자가 viewport를 보정할 입력이다.
   * `down` 확장은 아래쪽에 넣으므로 언제나 0 이다 — 그 차이가 방향의 유일한 관측값이다.
   */
  insertedAbove: number
}

function lineRow(lines: readonly DiffLine[], sourceIndex: number): DiffHunkLineRow {
  return {
    kind: 'line',
    id: `line:${sourceIndex}`,
    sourceIndex,
    line: lines[sourceIndex]
  }
}

function gapRow(start: number, end: number): DiffHunkGapRow {
  return { kind: 'gap', id: `gap:${start}:${end}`, start, end, canUp: false, canDown: false }
}

/**
 * gap 마다 가능한 방향을 채운다. 위/아래에 실제 hunk 가 있어야 그쪽으로 "더 보기" 가 뜻을 갖는다.
 * 양쪽 다 없으면(변경이 하나도 없는 본문) 아래 방향 하나는 남긴다 — 컨트롤이 0개면 사용자가
 * 그 파일을 영영 펼칠 수 없다.
 */
function withGapDirections(rows: readonly DiffHunkRow[]): DiffHunkRow[] {
  const lineIndexes = rows.flatMap((row, index) => (row.kind === 'line' ? [index] : []))
  const first = lineIndexes[0]
  const last = lineIndexes[lineIndexes.length - 1]
  return rows.map((row, index) => {
    if (row.kind !== 'gap') return row
    const hasFollowing = last !== undefined && last > index
    const hasPreceding = first !== undefined && first < index
    return { ...row, canUp: hasFollowing, canDown: hasPreceding || !hasFollowing }
  })
}

function deriveHunks(rows: readonly DiffHunkRow[]): readonly DiffHunk[] {
  const hunks: DiffHunk[] = []
  let current: DiffHunkLineRow[] = []
  for (const row of rows) {
    if (row.kind === 'line') {
      current.push(row)
      continue
    }
    if (current.length > 0) {
      hunks.push({ id: `hunk:${hunks.length}`, lines: current })
      current = []
    }
  }
  if (current.length > 0) hunks.push({ id: `hunk:${hunks.length}`, lines: current })
  return hunks
}

function withDerivedHunks(lines: readonly DiffLine[], rows: readonly DiffHunkRow[]): DiffHunkState {
  const directed = withGapDirections(rows)
  return { lines, rows: directed, hunks: deriveHunks(directed) }
}

/**
 * Changed lines와 그 양옆 context만 우선 보여 준다. 숨긴 unchanged 구간은 단일 gap으로
 * 남겨 두므로, 클릭 한 번이 다른 hunk나 gap의 identity를 바꾸지 않는다.
 */
export function buildDiffHunks(lines: readonly DiffLine[], context: number): DiffHunkState {
  const safeContext = Math.max(0, Math.floor(context))
  const ranges: Array<{ start: number; end: number }> = []

  lines.forEach((line, index) => {
    if (line.type === 'unchanged') return
    const start = Math.max(0, index - safeContext)
    const end = Math.min(lines.length, index + safeContext + 1)
    const previous = ranges[ranges.length - 1]
    if (previous && start <= previous.end) previous.end = Math.max(previous.end, end)
    else ranges.push({ start, end })
  })

  // 변경이 없는 본문은 gap만 놓는 대신, 사용자가 파일 전체를 한 번에 펼칠 수 있게 한다.
  if (ranges.length === 0 && lines.length > 0) {
    return withDerivedHunks(lines, [gapRow(0, lines.length)])
  }

  const rows: DiffHunkRow[] = []
  let cursor = 0
  for (const range of ranges) {
    if (cursor < range.start) rows.push(gapRow(cursor, range.start))
    for (let index = range.start; index < range.end; index += 1) rows.push(lineRow(lines, index))
    cursor = range.end
  }
  if (cursor < lines.length) rows.push(gapRow(cursor, lines.length))
  return withDerivedHunks(lines, rows)
}

/** 선택 줄 주변만 드러낸다. 큰 gap 전체를 열거나 기존 행 키를 바꾸지 않는다. */
export function revealDiffHunkLine(
  state: DiffHunkState,
  sourceIndex: number,
  context: number
): DiffHunkState {
  const gapIndex = state.rows.findIndex(
    (row) => row.kind === 'gap' && row.start <= sourceIndex && sourceIndex < row.end
  )
  const gap = state.rows[gapIndex]
  if (!gap || gap.kind !== 'gap') return state
  const safeContext = Math.max(0, Math.floor(context))
  const from = Math.max(gap.start, sourceIndex - safeContext)
  const to = Math.min(gap.end, sourceIndex + safeContext + 1)
  const replacement: DiffHunkRow[] = []
  if (gap.start < from) replacement.push(gapRow(gap.start, from))
  for (let index = from; index < to; index += 1) replacement.push(lineRow(state.lines, index))
  if (to < gap.end) replacement.push(gapRow(to, gap.end))
  return withDerivedHunks(state.lines, [
    ...state.rows.slice(0, gapIndex),
    ...replacement,
    ...state.rows.slice(gapIndex + 1)
  ])
}

/**
 * gap 을 **한 방향으로** n행 확장한다 (0211 ΔV4 D-090).
 *
 * `up` 은 gap 의 **끝쪽**(아래 hunk 에 붙는 쪽)을 열어 새 행이 다음 hunk 바로 위에 들어가고,
 * `insertedAbove` 가 scrollTop 보정에 필요한 정확한 개수를 준다. `down` 은 gap 의 **앞쪽**을
 * 열어 위 hunk 바로 아래에 넣으므로 보정이 필요 없다(`insertedAbove === 0`).
 *
 * 어느 방향이든 **기존 행의 키와 순서는 보존된다** — 확장이 목록을 다시 만들면 React 가 전부
 * 교체하고 사용자가 보던 위치가 사라진다(D-058 ①).
 */
export function expandGap(
  state: DiffHunkState,
  id: string,
  n: number,
  direction: GapDirection = 'up'
): GapExpansion {
  const rowIndex = state.rows.findIndex((row) => row.kind === 'gap' && row.id === id)
  const gap = state.rows[rowIndex]
  if (rowIndex < 0 || !gap || gap.kind !== 'gap') return { state, insertedAbove: 0 }

  const count = Math.min(gap.end - gap.start, Math.max(0, Math.floor(n)))
  if (count === 0) return { state, insertedAbove: 0 }

  const revealFrom = direction === 'up' ? gap.end - count : gap.start
  const revealTo = revealFrom + count
  const replacement: DiffHunkRow[] = []
  if (direction === 'down' && revealTo < gap.end) {
    for (let index = revealFrom; index < revealTo; index += 1)
      replacement.push(lineRow(state.lines, index))
    replacement.push(gapRow(revealTo, gap.end))
  } else {
    if (gap.start < revealFrom) replacement.push(gapRow(gap.start, revealFrom))
    for (let index = revealFrom; index < revealTo; index += 1)
      replacement.push(lineRow(state.lines, index))
  }
  const rows = [...state.rows.slice(0, rowIndex), ...replacement, ...state.rows.slice(rowIndex + 1)]
  const hasFollowingLine = state.rows.slice(rowIndex + 1).some((row) => row.kind === 'line')
  return {
    state: withDerivedHunks(state.lines, rows),
    insertedAbove: direction === 'up' && hasFollowingLine ? count : 0
  }
}
