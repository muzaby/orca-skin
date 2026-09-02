import type { DiffLine } from './diffLines'

// 표시 옵션 넷의 **순수 파생** (0211 ΔV4 D-088). 넷 다 이미 받은 패치 줄에서 계산하고 git 에
// 다시 묻지 않는다 — 재조회를 만들면 "요약 세대당 패치 1회"(D-078)가 그 자리에서 깨진다.

/** 공백만 다른 줄 쌍을 `unchanged` 로 접는다 — `git diff -w` 를 renderer 에서 한다. */
export function collapseWhitespaceOnlyChanges(lines: readonly DiffLine[]): DiffLine[] {
  const out: DiffLine[] = []
  let i = 0
  while (i < lines.length) {
    const run = changeRunAt(lines, i)
    if (!run) {
      out.push(lines[i])
      i += 1
      continue
    }
    const pairs = Math.min(run.removed.length, run.added.length)
    let collapsed = 0
    // 앞에서부터 짝을 맞춰 공백만 다른 것을 접는다. 하나라도 실제로 다르면 거기서 멈춘다 —
    // 뒤쪽만 골라 접으면 남은 줄들의 짝이 어긋나 화면이 엉뚱한 쌍을 보여준다.
    while (
      collapsed < pairs &&
      squash(run.removed[collapsed].text) === squash(run.added[collapsed].text)
    )
      collapsed += 1
    for (let k = 0; k < collapsed; k += 1) {
      const removed = run.removed[k]
      const added = run.added[k]
      out.push({
        type: 'unchanged',
        oldLine: removed.oldLine,
        newLine: added.newLine,
        lineNo: added.newLine ?? added.lineNo,
        text: added.text
      })
    }
    out.push(...run.removed.slice(collapsed), ...run.added.slice(collapsed))
    i = run.end
  }
  return out
}

function squash(text: string): string {
  return text.replace(/\s+/g, '')
}

function changeRunAt(
  lines: readonly DiffLine[],
  from: number
): { removed: DiffLine[]; added: DiffLine[]; end: number } | null {
  const removed: DiffLine[] = []
  const added: DiffLine[] = []
  let i = from
  while (i < lines.length && lines[i].type === 'removed') removed.push(lines[i++])
  while (i < lines.length && lines[i].type === 'added') added.push(lines[i++])
  return removed.length > 0 || added.length > 0 ? { removed, added, end: i } : null
}

/** 한 줄 안에서 실제로 바뀐 구간. `[시작, 끝)` 은 문자 인덱스이고 같으면 강조가 없다. */
export interface WordSpan {
  start: number
  end: number
}

/**
 * 바뀐 **토큰 구간** 하나를 구한다 (0211 ΔV4 D-089).
 *
 * 공백 경계로 자른 토큰의 공통 접두/접미를 걷어내고 남은 가운데가 그 구간이다. 새 의존성을
 * 넣지 않는 이유: 필요한 것은 한 쌍 안의 다른 구간 하나뿐이고, 접두/접미 제거는 순수·결정적이라
 * 단위 테스트가 쉽다.
 */
export function changedWordSpan(
  oldText: string,
  newText: string
): { old: WordSpan; new: WordSpan } {
  const oldTokens = tokenize(oldText)
  const newTokens = tokenize(newText)
  let head = 0
  while (head < oldTokens.length && head < newTokens.length && oldTokens[head] === newTokens[head])
    head += 1
  let tail = 0
  while (
    tail < oldTokens.length - head &&
    tail < newTokens.length - head &&
    oldTokens[oldTokens.length - 1 - tail] === newTokens[newTokens.length - 1 - tail]
  )
    tail += 1
  return {
    old: spanOf(oldTokens, head, tail),
    new: spanOf(newTokens, head, tail)
  }
}

function tokenize(text: string): string[] {
  return text.split(/(\s+)/).filter((token) => token.length > 0)
}

function spanOf(tokens: readonly string[], head: number, tail: number): WordSpan {
  const start = tokens.slice(0, head).join('').length
  const end = tokens.slice(0, tokens.length - tail).join('').length
  return start <= end ? { start, end } : { start, end: start }
}

/** 나란히 보기의 한 행 — 좌(old)·우(new) 중 하나가 비어 있을 수 있다. */
export interface SideBySideRow {
  left: DiffLine | null
  right: DiffLine | null
}

/**
 * 같은 줄 배열을 좌우 두 칸으로 짝짓는다 (0211 ΔV4 D-088).
 * 연속된 removed/added 묶음을 앞에서부터 마주 놓고, 남는 쪽은 반대편을 비운다.
 */
export function toSideBySideRows(lines: readonly DiffLine[]): SideBySideRow[] {
  const rows: SideBySideRow[] = []
  let i = 0
  while (i < lines.length) {
    if (lines[i].type === 'unchanged') {
      rows.push({ left: lines[i], right: lines[i] })
      i += 1
      continue
    }
    const run = changeRunAt(lines, i)
    if (!run) {
      i += 1
      continue
    }
    const height = Math.max(run.removed.length, run.added.length)
    for (let k = 0; k < height; k += 1)
      rows.push({ left: run.removed[k] ?? null, right: run.added[k] ?? null })
    i = run.end
  }
  return rows
}
