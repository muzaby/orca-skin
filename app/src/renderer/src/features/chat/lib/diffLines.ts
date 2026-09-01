import { diffLines } from 'diff'

// 두 문자열의 줄 단위 차이 — **React 없이 돌아가는 순수 파생**만 갖는다(0206 D-019).
//
// 도구 카드(`DiffBody`)와 diff 타일 두 곳이 같은 diff 를 그린다. 파생 규칙이 두 벌이 되면
// `+`/`-` 표기와 줄번호 기준이 갈라지므로 여기 한 곳이 소유한다. 렌더는 `components/DiffTable`
// 이 갖고, 이 파일은 그것이 그릴 줄 배열만 만든다.

export interface DiffPair {
  oldValue: string
  newValue: string
}

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

// 줄번호는 **각 축의 것**이다 — removed 는 old 축(`oldLine`), added 는 new 축(`newLine`),
// unchanged 는 new 축을 쓰고 둘 다 전진시킨다. 한 카운터로 합치면 삭제가 많은 diff 에서
// 이후 추가 줄의 번호가 실제 파일과 어긋난다.
export function buildDiffLines(oldValue: string, newValue: string): DiffLine[] {
  const hunks = diffLines(oldValue, newValue)
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
