// 상한 있는 동기 diff (0324 D-014 · MD-05). UI 스레드에서 `diff` 를 부르는 유일한 파일이다
// (가드 `check-ui-thread` 규칙 (b)) — 모든 함수가 입력 상한을 먼저 보고, 넘으면 계산하지 않는다.
// 넘는 입력의 줄 계산은 워커가 한다(`client.ts`).

import { diffLines, parsePatch, type StructuredPatch } from 'diff'
import { countLines, hunksToDiffLines, type DiffLine } from './diffModel'
import { DIFF_INLINE_MAX_LINES, PATCH_INLINE_MAX_CHARS } from './limits'

export function withinDiffCap(oldValue: string, newValue: string): boolean {
  return countLines(oldValue) + countLines(newValue) <= DIFF_INLINE_MAX_LINES
}

// 두 입력의 줄 수 합이 상한 이하면 줄 배열, 넘으면 `null`.
export function diffLinesWithinCap(oldValue: string, newValue: string): DiffLine[] | null {
  if (!withinDiffCap(oldValue, newValue)) return null
  return hunksToDiffLines(diffLines(oldValue, newValue))
}

// 추가·삭제 줄 수. 상한을 넘으면 세지 않는다(`null`) — 도구 카드 머리는 증감 수를 그리지 않는다.
export function diffStatWithinCap(
  oldValue: string,
  newValue: string
): { added: number; removed: number } | null {
  if (!withinDiffCap(oldValue, newValue)) return null
  let added = 0
  let removed = 0
  for (const part of diffLines(oldValue, newValue)) {
    if (part.added) added += part.count ?? 0
    else if (part.removed) removed += part.count ?? 0
  }
  return { added, removed }
}

// unified patch 파싱. 상한을 넘거나 형식이 틀리면 `null` — 소비자는 원문 표시로 폴백한다.
export function parsePatchWithinCap(patch: string): StructuredPatch[] | null {
  if (patch.length > PATCH_INLINE_MAX_CHARS) return null
  try {
    return parsePatch(patch)
  } catch {
    return null
  }
}
