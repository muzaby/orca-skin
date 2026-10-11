// 툴팁 대상 찾기 · `title` 이동/원복 — 순수부(0257 D-005). DOM 대신 아래 최소 형상만 쓴다.
//
// OS 가 그리는 `title` 툴팁은 CSS 로 색을 바꿀 수 없다. 그래서 마우스가 올라간 동안만 `title` 을
// `TOOLTIP_ATTR` 로 옮겨 OS 툴팁을 막고 검은 툴팁을 그린 뒤, 떠나면 되돌린다. React 는 prop 이
// 바뀔 때만 속성을 쓰므로 옮겨 둔 값은 다시 덮이지 않는다 — 바뀌면 호스트가 다시 옮긴다.

export const TOOLTIP_ATTR = 'data-orca-tooltip'
/** OS 기본 툴팁과 같은 체감의 표시 지연. */
export const TOOLTIP_SHOW_DELAY_MS = 500
/** 직전 툴팁이 이 시간 안에 닫혔으면 다음 대상은 지연 없이 보인다. */
export const TOOLTIP_WARM_MS = 300

export interface TooltipNode {
  readonly tagName: string
  readonly parentElement: TooltipNode | null
  getAttribute(name: string): string | null
  setAttribute(name: string, value: string): void
  removeAttribute(name: string): void
  hasAttribute(name: string): boolean
}

/** 시작 요소부터 부모로 올라가며 툴팁 문구를 가진 첫 요소. 빈 `title` 은 조상 툴팁을 끈다(OS 동작). */
export function findTooltipAnchor(start: TooltipNode | null): TooltipNode | null {
  for (let node = start; node; node = node.parentElement) {
    const tag = node.tagName.toUpperCase()
    if (tag === 'BODY' || tag === 'HTML') return null
    // iframe 의 title 은 접근성 이름이지 툴팁이 아니다 — 안쪽 이벤트도 이 문서로 오지 않는다.
    if (tag === 'IFRAME') continue
    if (node.hasAttribute(TOOLTIP_ATTR)) return node
    const title = node.getAttribute('title')
    if (title === '') return null
    if (title !== null) return node
  }
  return null
}

/** `title` 을 `TOOLTIP_ATTR` 로 옮기고 문구를 돌려준다. 이미 옮겼으면 옮긴 값. */
export function claimTitle(node: TooltipNode): string {
  const title = node.getAttribute('title')
  if (title !== null) {
    node.setAttribute(TOOLTIP_ATTR, title)
    node.removeAttribute('title')
    return title
  }
  return node.getAttribute(TOOLTIP_ATTR) ?? ''
}

/** 옮긴 값을 `title` 로 되돌린다. 그 사이 컴포넌트가 새 `title` 을 달았으면 그 값을 남긴다. */
export function releaseTitle(node: TooltipNode): void {
  const stashed = node.getAttribute(TOOLTIP_ATTR)
  if (stashed === null) return
  if (!node.hasAttribute('title')) node.setAttribute('title', stashed)
  node.removeAttribute(TOOLTIP_ATTR)
}
