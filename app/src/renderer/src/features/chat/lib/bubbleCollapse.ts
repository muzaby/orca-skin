// 사용자 버블 접기 판정(0257 D-008) — 순수부. 측정값(scrollHeight·line-height)만 받는다.

/** 이 줄 수를 넘으면 접는다 — 첨부 8 실측(보이는 줄 10). 접힘 클래스 `max-h-[10lh]` 와 같은 값. */
export const USER_BUBBLE_COLLAPSED_LINES = 10

/** 접힌 본문: 10줄 높이 + 마지막 줄 흐림(배경색을 몰라도 되는 마스크). */
export const USER_BUBBLE_COLLAPSED_CLASS =
  'max-h-[10lh] overflow-hidden [mask-image:linear-gradient(to_bottom,black_calc(100%_-_1.5lh),transparent)]'

/** 계산된 line-height 를 px 로. `normal` 은 브라우저 관례 1.2배, 단위 없는 수는 글자 크기 배수. */
export function lineHeightPx(lineHeight: string, fontSize: string): number {
  const size = Number.parseFloat(fontSize) || 14.5
  if (lineHeight.endsWith('px')) return Number.parseFloat(lineHeight)
  const multiplier = Number.parseFloat(lineHeight)
  return (Number.isFinite(multiplier) ? multiplier : 1.2) * size
}

/** 본문 전체 높이가 10줄을 넘는가. 1px 은 소수 반올림 여유. */
export function bubbleOverflows(input: { scrollHeight: number; lineHeightPx: number }): boolean {
  return input.scrollHeight > input.lineHeightPx * USER_BUBBLE_COLLAPSED_LINES + 1
}

/** 접은 뒤 버블 위쪽이 스크롤 영역 위로 벗어나 있으면 보이게 스크롤한다(D-012). */
export function shouldScrollAfterCollapse(bubbleTop: number, viewportTop: number): boolean {
  return bubbleTop < viewportTop
}

/** 렌더 결정 — 판정·펼침 상태 → 본문 클래스·버튼 라벨. */
export function bubbleView(state: { overflowing: boolean; expanded: boolean }): {
  collapsed: boolean
  toggleLabelKey: 'chat.transcript.showMore' | 'chat.transcript.showLess' | null
} {
  if (!state.overflowing) return { collapsed: false, toggleLabelKey: null }
  return state.expanded
    ? { collapsed: false, toggleLabelKey: 'chat.transcript.showLess' }
    : { collapsed: true, toggleLabelKey: 'chat.transcript.showMore' }
}
