import type { StructuredPatch, parsePatch } from 'diff'

export type DiffStatSource =
  { kind: 'pair'; before: string; after: string } | { kind: 'patch'; patch: string }

export interface DiffStat {
  added: number
  removed: number
}

export function countDiffStats(
  sources: readonly DiffStatSource[],
  compare: (
    before: string,
    after: string
  ) => readonly { added?: boolean; removed?: boolean; count: number }[],
  patches: typeof parsePatch
): DiffStat {
  let added = 0
  let removed = 0
  for (const source of sources) {
    if (source.kind === 'pair') {
      for (const part of compare(source.before, source.after)) {
        if (part.added) added += part.count ?? 0
        else if (part.removed) removed += part.count ?? 0
      }
      continue
    }
    // 형식이 틀린 patch 는 그 파일만 0 이다(원문 표시 폴백과 같다).
    let files: StructuredPatch[]
    try {
      files = patches(source.patch)
    } catch {
      continue
    }
    for (const file of files)
      for (const hunk of file.hunks)
        for (const line of hunk.lines) {
          if (line[0] === '+') added++
          else if (line[0] === '-') removed++
        }
  }
  return { added, removed }
}
