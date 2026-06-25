// 계획 본문(마크다운 렌더 DOM) 위에서 텍스트 선택 ↔ 오프셋 ↔ DOM Range ↔ 화면 rect 를
// 매핑하는 헬퍼. 순수 함수 아님(브라우저 DOM 의존) — 시각 검증으로 갈음(AGENTS.md 규칙 4).
//
// 오프셋 일관성: 선택→오프셋은 `Range.toString().length`(컨테이너 시작~경계의 텍스트 길이),
// 오프셋→Range 는 텍스트 노드 길이 누적으로 복원한다. 두 척도는 동일(텍스트 노드 data 길이의
// 합 = pre-range toString 길이)하므로 왕복이 안정적이다.

export interface PlanSelectionOffsets {
  start: number
  end: number
  quote: string
}

export interface OverlayRect {
  top: number
  left: number
  width: number
  height: number
}

// 현재 Selection 을 컨테이너 textContent 기준 오프셋으로 변환. collapsed/공백/컨테이너 밖
// 선택은 null.
export function offsetsFromSelection(
  container: HTMLElement,
  selection: Selection
): PlanSelectionOffsets | null {
  if (selection.rangeCount === 0 || selection.isCollapsed) return null
  const range = selection.getRangeAt(0)
  if (!container.contains(range.startContainer) || !container.contains(range.endContainer)) {
    return null
  }
  const quote = range.toString()
  if (quote.trim() === '') return null
  const pre = range.cloneRange()
  pre.selectNodeContents(container)
  pre.setEnd(range.startContainer, range.startOffset)
  const start = pre.toString().length
  return { start, end: start + quote.length, quote }
}

// 오프셋 → 텍스트 노드 + 로컬 offset. 경계(노드 끝)는 다음 검색에서 자연히 흡수된다.
function locate(container: HTMLElement, target: number): { node: Text; offset: number } | null {
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT)
  let acc = 0
  let last: Text | null = null
  let node = walker.nextNode() as Text | null
  while (node) {
    const len = node.data.length
    if (target <= acc + len) return { node, offset: target - acc }
    acc += len
    last = node
    node = walker.nextNode() as Text | null
  }
  if (last && target === acc) return { node: last, offset: last.data.length }
  return null
}

// 오프셋 구간 → DOM Range 복원. 매핑 실패(본문 변경 등)면 null.
export function rangeFromOffsets(container: HTMLElement, start: number, end: number): Range | null {
  const a = locate(container, start)
  const b = locate(container, end)
  if (!a || !b) return null
  const range = document.createRange()
  try {
    range.setStart(a.node, a.offset)
    range.setEnd(b.node, b.offset)
  } catch {
    return null
  }
  return range
}

// Range 의 클라이언트 rect 들을 스크롤 컨테이너 콘텐츠 기준 좌표로 변환(절대배치 오버레이용).
// 콘텐츠 좌표라 스크롤 위치와 무관하게 안정적이다(오버레이가 콘텐츠와 함께 스크롤).
export function rectsForRange(range: Range, container: HTMLElement): OverlayRect[] {
  const cRect = container.getBoundingClientRect()
  return Array.from(range.getClientRects()).map((r) => ({
    top: r.top - cRect.top + container.scrollTop,
    left: r.left - cRect.left + container.scrollLeft,
    width: r.width,
    height: r.height
  }))
}
