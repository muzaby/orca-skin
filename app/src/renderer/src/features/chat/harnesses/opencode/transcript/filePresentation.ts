import { diffStatWithinCap } from '../../../../../shared/compute/inline'
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

// 도구 카드 머리의 증감 수. 줄 수 합이 상한을 넘는 파일이 하나라도 있으면 세지 않는다(`null`).
export function fileChanges(files: OpenCodeFileView[]): { added: number; removed: number } | null {
  let added = 0
  let removed = 0
  for (const file of files) {
    const source = fileDiffSource(file)
    if (source.kind === 'pair') {
      const stat = diffStatWithinCap(source.before, source.after)
      if (!stat) return null
      added += stat.added
      removed += stat.removed
    } else {
      added += source.lines.filter((line) => line.type === 'added').length
      removed += source.lines.filter((line) => line.type === 'removed').length
    }
  }
  return { added, removed }
}
