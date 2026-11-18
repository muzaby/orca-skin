import { diffStatsWithinBudget } from '../../../../../shared/compute/inline'
import type { DiffLine } from '../../../lib/diffLines'
import { unifiedDiffLines } from '../../../lib/unifiedDiffLines'
import type { OpenCodeFileView } from '../toolPresentation'

export const fileName = (path: string): string => path.replace(/\\/g, '/').split('/').at(-1) || path

// 파일 변경의 줄 원천 — 전·후 본문 쌍이면 줄 계산이 필요하고(`hooks/useDiffLines` 가 상한에 따라
// UI 스레드 또는 워커에서 한다, 0324), patch 면 이미 줄 좌표를 갖고 있다.
export type FileDiffSource =
  { kind: 'pair'; before: string; after: string } | { kind: 'lines'; lines: DiffLine[] }

export function fileDiffSource(file: OpenCodeFileView): FileDiffSource {
  return file.before != null || file.after != null
    ? { kind: 'pair', before: file.before ?? '', after: file.after ?? '' }
    : { kind: 'lines', lines: unifiedDiffLines(file.patch ?? '') }
}

// 도구 카드 머리의 증감 수 — 파일 전부를 합산 예산으로 판정한다(0325 D-009 · D-037 · EP-4 ⑦). 원천은
// 파싱 전의 원문(쌍 · patch)이라 예산을 넘으면 diff·patch 파싱을 하지 않는다. 펼친 본문은 `fileDiffSource`
// 를 그대로 쓴다(0325 B21).
export function fileChanges(files: OpenCodeFileView[]): { added: number; removed: number } | null {
  return diffStatsWithinBudget(
    files.map((file) =>
      file.before != null || file.after != null
        ? { kind: 'pair', before: file.before ?? '', after: file.after ?? '' }
        : { kind: 'patch', patch: file.patch ?? '' }
    )
  )
}
