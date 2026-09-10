export interface SidePaneBounds {
  min: number
  max: number
}

export function sidePaneBounds(hostWidth: number): SidePaneBounds {
  const max = Math.max(0, Math.min(960, hostWidth - 240))
  return { min: Math.min(320, max), max }
}

export function clampSidePaneWidth(width: number, bounds: SidePaneBounds): number {
  return Math.max(bounds.min, Math.min(bounds.max, Math.round(width)))
}

export function resizeSidePaneByKey(
  key: string,
  width: number,
  bounds: SidePaneBounds
): number | undefined {
  if (key === 'Home') return bounds.min
  if (key === 'End') return bounds.max
  if (key === 'ArrowLeft') return clampSidePaneWidth(width + 20, bounds)
  if (key === 'ArrowRight') return clampSidePaneWidth(width - 20, bounds)
  return undefined
}

// Pointer capture keeps events in the parent document. The shield also keeps embedded
// documents from taking focus or selection while the pointer crosses their surface.
export function startSidePaneDrag({
  target,
  pointerId,
  right,
  bounds,
  onChange,
  onFinish
}: {
  target: HTMLElement
  pointerId: number
  right: number
  bounds: SidePaneBounds
  onChange: (width: number) => void
  onFinish: () => void
}): () => void {
  const doc = target.ownerDocument
  const win = doc.defaultView!
  const shield = doc.createElement('div')
  shield.className = 'fixed inset-0 z-[2147483647] cursor-col-resize touch-none select-none'
  shield.setAttribute('data-side-pane-drag-shield', '')
  shield.setAttribute('aria-hidden', 'true')
  doc.body.append(shield)
  target.setPointerCapture(pointerId)
  let active = true
  const finish = (): void => {
    if (!active) return
    active = false
    win.removeEventListener('pointermove', move)
    win.removeEventListener('pointerup', end)
    win.removeEventListener('pointercancel', end)
    win.removeEventListener('blur', finish)
    win.removeEventListener('keydown', key)
    shield.remove()
    if (target.hasPointerCapture(pointerId)) target.releasePointerCapture(pointerId)
    onFinish()
  }
  const move = (event: PointerEvent): void => {
    if (event.pointerId === pointerId) onChange(clampSidePaneWidth(right - event.clientX, bounds))
  }
  const end = (event: PointerEvent): void => {
    if (event.pointerId === pointerId) finish()
  }
  const key = (event: KeyboardEvent): void => {
    if (event.key === 'Escape') finish()
  }
  win.addEventListener('pointermove', move)
  win.addEventListener('pointerup', end)
  win.addEventListener('pointercancel', end)
  win.addEventListener('blur', finish)
  win.addEventListener('keydown', key)
  return finish
}
