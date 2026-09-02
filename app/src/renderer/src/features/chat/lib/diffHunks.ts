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
}

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
  /** 현재 보이는 hunk 위에 삽입된 행 수. 스크롤 소유자가 viewport를 보정할 입력이다. */
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
  return { kind: 'gap', id: `gap:${start}:${end}`, start, end }
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
  return { lines, rows, hunks: deriveHunks(rows) }
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

/**
 * Gap의 아래쪽 끝을 n행만 확장한다. 그래서 새 행은 다음 hunk 바로 위에 들어가며,
 * `insertedAbove`가 scrollTop 보정에 필요한 정확한 개수를 준다.
 */
export function expandGap(state: DiffHunkState, id: string, n: number): GapExpansion {
  const rowIndex = state.rows.findIndex((row) => row.kind === 'gap' && row.id === id)
  const gap = state.rows[rowIndex]
  if (rowIndex < 0 || !gap || gap.kind !== 'gap') return { state, insertedAbove: 0 }

  const count = Math.min(gap.end - gap.start, Math.max(0, Math.floor(n)))
  if (count === 0) return { state, insertedAbove: 0 }

  const split = gap.end - count
  const replacement: DiffHunkRow[] = []
  if (gap.start < split) replacement.push(gapRow(gap.start, split))
  for (let index = split; index < gap.end; index += 1) replacement.push(lineRow(state.lines, index))
  const rows = [...state.rows.slice(0, rowIndex), ...replacement, ...state.rows.slice(rowIndex + 1)]
  const hasFollowingLine = state.rows.slice(rowIndex + 1).some((row) => row.kind === 'line')
  return { state: withDerivedHunks(state.lines, rows), insertedAbove: hasFollowingLine ? count : 0 }
}
