import type { RightPanelTileId } from './rightPanelTiles'

export function adjustPanelViewport(viewport: HTMLDivElement, tile?: RightPanelTileId): void {
  let left = viewport.scrollLeft
  if (tile) {
    const column = viewport.querySelector<HTMLElement>(`[data-panel-tiles~="${tile}"]`)
    if (column) {
      const bounds = viewport.getBoundingClientRect()
      const target = column.getBoundingClientRect()
      if (target.left < bounds.left || target.right - target.left > viewport.clientWidth)
        left += target.left - bounds.left
      else if (target.right > bounds.right) left += target.right - bounds.right
    }
  }
  viewport.scrollLeft = Math.max(0, Math.min(left, viewport.scrollWidth - viewport.clientWidth))
}
