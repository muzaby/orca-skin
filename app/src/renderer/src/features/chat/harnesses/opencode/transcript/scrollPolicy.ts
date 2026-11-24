import {
  BOTTOM_EPSILON,
  type ScrollGeometry
} from '../../../lib/transcript/viewport/scrollGeometry'
export {
  BOTTOM_EPSILON,
  canConsumeScroll,
  type ScrollGeometry
} from '../../../lib/transcript/viewport/scrollGeometry'
export function bottomDistance({ top, height, viewport }: ScrollGeometry): number {
  return Math.max(0, height - viewport - top)
}
export function isTimelineBottom(geometry: ScrollGeometry): boolean {
  return bottomDistance(geometry) <= BOTTOM_EPSILON
}
export function shouldShowTimelineJump(geometry: ScrollGeometry): boolean {
  return bottomDistance(geometry) > Math.max(400, geometry.viewport)
}
// Only a user scroll can re-pin. Content growth/measurement alone must never
// turn a reader's unpinned position back into automatic following.
export function nextTimelinePin(
  pinned: boolean,
  event: 'up' | 'selection' | 'jump' | 'scroll' | 'resize',
  geometry: ScrollGeometry
): boolean {
  if (event === 'jump') return true
  if (event === 'up' || event === 'selection') return false
  if (event === 'scroll') return isTimelineBottom(geometry)
  return pinned
}
