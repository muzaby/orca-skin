export const BOTTOM_EPSILON = 0.5
export interface ScrollGeometry {
  top: number
  height: number
  viewport: number
}
export function canConsumeScroll(geometry: ScrollGeometry, direction = 0): boolean {
  const max = Math.max(0, geometry.height - geometry.viewport)
  if (max <= BOTTOM_EPSILON) return false
  if (direction < 0) return geometry.top > BOTTOM_EPSILON
  if (direction > 0) return geometry.top < max - BOTTOM_EPSILON
  return true
}

export function nestedScrollConsumes(
  target: EventTarget | null,
  viewport: Element,
  direction = 0
): boolean {
  if (!(target instanceof Element)) return false
  for (let node: Element | null = target; node && node !== viewport; node = node.parentElement) {
    if (
      canConsumeScroll(
        { top: node.scrollTop, height: node.scrollHeight, viewport: node.clientHeight },
        direction
      ) &&
      /auto|scroll/.test(getComputedStyle(node).overflowY)
    )
      return true
  }
  return false
}
