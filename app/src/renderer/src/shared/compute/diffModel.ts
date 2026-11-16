// diff 줄 모델과 jsdiff 결과 → 줄 변환 (0206 D-019 · 0324). `diff` 패키지를 값으로 물지 않는
// 순수 변환이라 UI 스레드(`inline.ts`)와 워커(`worker/handler.ts`)가 같은 규칙을 쓴다.

export interface DiffLine {
  type: 'added' | 'removed' | 'unchanged'
  /** 이전 파일 축의 줄번호. 새로 추가된 행은 이전 파일에 없으므로 null 이다. */
  oldLine: number | null
  /** 새 파일 축의 줄번호. 삭제된 행은 새 파일에 없으므로 null 이다. */
  newLine: number | null
  // 기존 도구 카드의 단일 거터 계약을 보존한다. removed=old, 그 외=new 축이다.
  lineNo: number
  text: string
}

// jsdiff `diffLines` 가 내는 조각 중 이 변환이 읽는 필드.
export interface DiffHunk {
  value: string
  added?: boolean
  removed?: boolean
}

// 줄번호는 **각 축의 것**이다 — removed 는 old 축(`oldLine`), added 는 new 축(`newLine`),
// unchanged 는 new 축을 쓰고 둘 다 전진시킨다. 한 카운터로 합치면 삭제가 많은 diff 에서
// 이후 추가 줄의 번호가 실제 파일과 어긋난다.
export function hunksToDiffLines(hunks: readonly DiffHunk[]): DiffLine[] {
  const result: DiffLine[] = []
  let oldLine = 1
  let newLine = 1

  for (const hunk of hunks) {
    const lines = hunk.value.split('\n')
    // diffLines 는 값이 개행으로 끝나면 마지막 빈 문자열을 포함시킨다.
    if (lines[lines.length - 1] === '') lines.pop()

    if (hunk.removed) {
      for (const text of lines) {
        result.push({ type: 'removed', oldLine, newLine: null, lineNo: oldLine, text })
        oldLine++
      }
    } else if (hunk.added) {
      for (const text of lines) {
        result.push({ type: 'added', oldLine: null, newLine, lineNo: newLine, text })
        newLine++
      }
    } else {
      for (const text of lines) {
        result.push({ type: 'unchanged', oldLine, newLine, lineNo: newLine, text })
        oldLine++
        newLine++
      }
    }
  }

  return result
}

// 텍스트의 줄 수 — 빈 문자열은 0, 마지막 개행 뒤의 빈 줄은 세지 않는다.
export function countLines(text: string): number {
  if (text === '') return 0
  let count = 1
  for (let i = text.indexOf('\n'); i !== -1; i = text.indexOf('\n', i + 1)) count++
  return text.endsWith('\n') ? count - 1 : count
}
