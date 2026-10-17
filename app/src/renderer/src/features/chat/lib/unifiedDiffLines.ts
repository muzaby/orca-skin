import { parsePatch } from 'diff'
import type { DiffLine } from './diffLines'

// 표준 unified patch를 공통 diff 좌표로 변환한다. 파싱 실패는 원문 표시로 폴백한다.
export function unifiedDiffLines(patch: string): DiffLine[] {
  try {
    return parsePatch(patch).flatMap((file) =>
      file.hunks.flatMap((hunk) => {
        let old = hunk.oldStart,
          next = hunk.newStart
        const lines: DiffLine[] = []
        for (const line of hunk.lines) {
          if (line[0] === '+')
            lines.push({
              type: 'added',
              oldLine: null,
              newLine: next,
              lineNo: next++,
              text: line.slice(1)
            })
          else if (line[0] === '-')
            lines.push({
              type: 'removed',
              oldLine: old,
              newLine: null,
              lineNo: old++,
              text: line.slice(1)
            })
          else if (line[0] === ' ')
            lines.push({
              type: 'unchanged',
              oldLine: old++,
              newLine: next,
              lineNo: next++,
              text: line.slice(1)
            })
        }
        return lines
      })
    )
  } catch {
    return []
  }
}
