// 상한 있는 동기 diff (0324 D-014 · MD-05). UI 스레드에서 `diff` 를 부르는 유일한 파일이다
// (가드 `check-ui-thread` 규칙 (b)) — 모든 함수가 입력 상한을 먼저 보고, 넘으면 계산하지 않는다.
// 넘는 입력의 줄 계산은 워커가 한다(`client.ts`).

import { diffLines, parsePatch, type StructuredPatch } from 'diff'
import { countDiffStats, type DiffStatSource } from './diffStats'
import { countLinesUpTo, hunksToDiffLines, type DiffLine } from './diffModel'
import { DIFF_INLINE_MAX_CHARS, DIFF_INLINE_MAX_LINES, PATCH_INLINE_MAX_CHARS } from './limits'

// 문자 합을 먼저 보고(넘으면 줄을 세지 않는다), 줄 합은 상한을 넘는 순간 세기를 멈춘다(0325 D-008).
export function withinDiffCap(oldValue: string, newValue: string): boolean {
  if (oldValue.length + newValue.length > DIFF_INLINE_MAX_CHARS) return false
  const oldLines = countLinesUpTo(oldValue, DIFF_INLINE_MAX_LINES)
  if (oldLines > DIFF_INLINE_MAX_LINES) return false
  return (
    oldLines + countLinesUpTo(newValue, DIFF_INLINE_MAX_LINES - oldLines) <= DIFF_INLINE_MAX_LINES
  )
}

// 두 입력의 줄 수 합이 상한 이하면 줄 배열, 넘으면 `null`.
export function diffLinesWithinCap(oldValue: string, newValue: string): DiffLine[] | null {
  if (!withinDiffCap(oldValue, newValue)) return null
  return hunksToDiffLines(diffLines(oldValue, newValue))
}

// 증감 수의 원천 — 전·후 본문 쌍 또는 patch 원문. 파싱 전의 원문이라 길이로 먼저 판정한다(0325 D-037).
export type { DiffStatSource } from './diffStats'

// 카드 하나의 원천 전부를 합산 예산으로 판정한 증감 수 (0325 D-009 · D-037 · EP-4 ⑤). 1단계는 원문 길이만
// 본다 — 쌍 문자 합 ≤ 64,000 · 쌍 줄 합 ≤ 400(조기 중단) · patch 문자 합 ≤ 1,000,000. 하나라도 넘으면
// jsdiff·`parsePatch` 를 한 번도 부르지 않고 `null`. 통과한 뒤에만 2단계에서 diff·파싱한다.
export function diffStatsWithinBudget(
  sources: readonly DiffStatSource[]
): { added: number; removed: number } | null {
  let pairChars = 0
  let patchChars = 0
  for (const source of sources) {
    if (source.kind === 'pair') pairChars += source.before.length + source.after.length
    else patchChars += source.patch.length
  }
  if (pairChars > DIFF_INLINE_MAX_CHARS || patchChars > PATCH_INLINE_MAX_CHARS) return null
  let lines = 0
  for (const source of sources) {
    if (source.kind !== 'pair') continue
    lines += countLinesUpTo(source.before, DIFF_INLINE_MAX_LINES - lines)
    if (lines > DIFF_INLINE_MAX_LINES) return null
    lines += countLinesUpTo(source.after, DIFF_INLINE_MAX_LINES - lines)
    if (lines > DIFF_INLINE_MAX_LINES) return null
  }
  return countDiffStats(sources, diffLines, parsePatch)
}

// 추가·삭제 줄 수. 상한을 넘으면 세지 않는다(`null`) — 도구 카드 머리는 증감 수를 그리지 않는다.
export function diffStatWithinCap(
  oldValue: string,
  newValue: string
): { added: number; removed: number } | null {
  return diffStatsWithinBudget([{ kind: 'pair', before: oldValue, after: newValue }])
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
