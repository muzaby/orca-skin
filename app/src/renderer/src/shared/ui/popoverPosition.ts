export type PopoverPlacement = 'top' | 'bottom' | 'right'
export interface PopoverPosition {
  left?: number
  right?: number
  top?: number
  bottom?: number
}

/** Viewport coordinates for the fixed portal surface. */
export function popoverPosition({
  anchor,
  boundaryRight = anchor.right,
  width,
  height,
  viewportWidth,
  viewportHeight,
  placement,
  align,
  gap = 6
}: {
  anchor: Pick<DOMRect, 'left' | 'right' | 'top' | 'bottom' | 'width'>
  boundaryRight?: number
  width: number
  height: number
  viewportWidth: number
  viewportHeight: number
  placement: PopoverPlacement
  align: 'start' | 'center' | 'end'
  gap?: number
}): PopoverPosition {
  const edge = 8
  const clamp = (value: number, extent: number, size: number): number =>
    Math.max(edge, Math.min(value, extent - size - edge))
  if (placement === 'right')
    return {
      left: clamp(boundaryRight + gap, viewportWidth, width),
      top: clamp(anchor.top, viewportHeight, height)
    }
  const horizontal =
    align === 'end'
      ? { right: clamp(viewportWidth - anchor.right, viewportWidth, width) }
      : {
          left: clamp(
            align === 'center' ? anchor.left + anchor.width / 2 - width / 2 : anchor.left,
            viewportWidth,
            width
          )
        }
  const resolved =
    placement === 'top' && height + gap + edge > anchor.top
      ? 'bottom'
      : placement === 'bottom' && height + gap + edge > viewportHeight - anchor.bottom
        ? 'top'
        : placement
  return resolved === 'bottom'
    ? { ...horizontal, top: anchor.bottom + gap }
    : { ...horizontal, bottom: viewportHeight - anchor.top + gap }
}
