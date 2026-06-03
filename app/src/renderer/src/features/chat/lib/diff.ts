// 라인 단위 diff (순수). git-diff 스타일 렌더(DiffBody)와 +N-M 카운트(toolMeta) 의 단일 소스.
// 외부 의존 없이 LCS 로 라인 정렬 — 작은 입력(파일 한 개/편집 한 건) 기준이라 O(n*m) 로 충분.

export interface DiffRow {
  type: 'add' | 'del' | 'context'
  // 펼친 카드의 거터에 표시할 라인넘버. 파일 전체가 없으므로 startLine(기본 1)부터 베스트에포트.
  oldNo: number | null
  newNo: number | null
  text: string
}

export interface DiffResult {
  rows: DiffRow[]
  added: number
  removed: number
}

function splitLines(text: string): string[] {
  if (text === '') return []
  // 끝의 단일 개행은 라인 수에 포함하지 않는다.
  const t = text.endsWith('\n') ? text.slice(0, -1) : text
  return t.split('\n')
}

// LCS 길이 테이블 → 공통 부분수열을 따라 add/del/context 행 생성.
export function diffLines(oldText: string, newText: string, startLine = 1): DiffResult {
  const a = splitLines(oldText)
  const b = splitLines(newText)
  const n = a.length
  const m = b.length

  // lcs[i][j] = a[i..], b[j..] 의 LCS 길이
  const lcs: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0))
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      lcs[i][j] = a[i] === b[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1])
    }
  }

  const rows: DiffRow[] = []
  let added = 0
  let removed = 0
  let i = 0
  let j = 0
  let oldNo = startLine
  let newNo = startLine
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      rows.push({ type: 'context', oldNo, newNo, text: a[i] })
      i++
      j++
      oldNo++
      newNo++
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
      rows.push({ type: 'del', oldNo, newNo: null, text: a[i] })
      removed++
      i++
      oldNo++
    } else {
      rows.push({ type: 'add', oldNo: null, newNo, text: b[j] })
      added++
      j++
      newNo++
    }
  }
  while (i < n) {
    rows.push({ type: 'del', oldNo, newNo: null, text: a[i] })
    removed++
    i++
    oldNo++
  }
  while (j < m) {
    rows.push({ type: 'add', oldNo: null, newNo, text: b[j] })
    added++
    j++
    newNo++
  }

  return { rows, added, removed }
}
