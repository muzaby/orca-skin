import type { GitDiffPatchLine } from '../../../../../shared/ipc'
import type { DiffLine } from './diffLines'

// main 이 파싱해 보낸 패치 줄 → 렌더가 쓰는 `DiffLine` (0211 ΔV4).
//
// **한 자리에서만 변환한다.** `DiffLine` 은 도구 카드(`DiffBody`)와 변경사항 패널이 함께 쓰는
// 계약이라 축이 셋(`oldLine`·`newLine`·`lineNo`)인데, 패치 줄은 앞의 둘만 갖는다. 소비처마다
// `lineNo` 를 채우면 removed 가 old 축인지 new 축인지가 곧 갈라진다.
export function patchLinesToDiffLines(lines: readonly GitDiffPatchLine[]): DiffLine[] {
  return lines.map((line) => ({
    type: line.type,
    oldLine: line.oldLine,
    newLine: line.newLine,
    // 기존 단일 거터 계약 그대로 — removed 는 old 축, 나머지는 new 축이다(`diffLines.ts`).
    lineNo: line.type === 'removed' ? (line.oldLine ?? 0) : (line.newLine ?? line.oldLine ?? 0),
    text: line.text
  }))
}
