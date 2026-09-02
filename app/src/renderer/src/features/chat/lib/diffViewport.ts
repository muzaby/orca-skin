export interface UpwardExpansionSnapshot {
  scrollTop: number
  scrollHeight: number
  clientHeight: number
  anchorDelta: number
  tailSpacerHeight: number
}

export interface UpwardExpansionCompensation {
  scrollTop: number
  tailSpacerHeight: number
}

/**
 * 위쪽에 줄을 삽입한 뒤 기존 anchor를 같은 viewport 위치로 되돌릴 계획을 계산한다.
 * 본문이 viewport보다 짧으면 scrollTop만 올릴 수 없으므로 부족한 범위를 꼬리 여백으로 만든다.
 */
export function planUpwardExpansionCompensation({
  scrollTop,
  scrollHeight,
  clientHeight,
  anchorDelta,
  tailSpacerHeight
}: UpwardExpansionSnapshot): UpwardExpansionCompensation {
  const delta = Math.max(0, anchorDelta)
  const targetScrollTop = scrollTop + delta
  const requiredScrollHeight = clientHeight + targetScrollTop
  const shortfall = Math.max(0, requiredScrollHeight - scrollHeight)
  return {
    scrollTop: targetScrollTop,
    tailSpacerHeight: tailSpacerHeight + shortfall
  }
}
