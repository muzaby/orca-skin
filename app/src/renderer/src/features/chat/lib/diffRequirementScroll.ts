import type { FileSectionOwner } from './fileSectionScroll'

/** 선택 코멘트만 diff 소유자 안에서 드러낸다. 입력 포커스는 호출한 표면에 남긴다. */
export function revealDiffRequirement(owner: FileSectionOwner | null, id: string): boolean {
  const target = owner?.querySelector(`[data-diff-requirement-marker="${CSS.escape(id)}"]`) ?? null
  target?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  return target !== null
}
