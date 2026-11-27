export interface PairedBounds {
  width: number
  seam: number
  hostError: number
}

export function pairedBounds(pane: Element, panel: Element, host: Element): PairedBounds {
  const a = pane.getBoundingClientRect()
  const b = panel.getBoundingClientRect()
  const outer = host.getBoundingClientRect()
  return {
    width: b.width,
    seam: b.left - a.right,
    hostError: Math.max(
      Math.abs(outer.left - a.left),
      Math.abs(outer.right - b.right),
      Math.abs(outer.width - a.width - b.width)
    )
  }
}

export function layerOffset(layer: Element | null): number {
  return layer
    ? layer.getBoundingClientRect().x - (layer.parentElement?.getBoundingClientRect().x ?? 0)
    : 0
}

interface Reading {
  key: string | null | undefined
  text: string | null
  top: number
}

export function firstVisibleParagraph(scroller: HTMLElement): Reading | null {
  const viewportTop = scroller.getBoundingClientRect().top
  const lastTop = scroller.clientHeight - 20
  for (const p of scroller.querySelectorAll('p')) {
    const top = p.getBoundingClientRect().top
    const y = top - viewportTop
    if (y >= 0 && y < lastTop && p.textContent?.trim()) {
      return {
        key: p.closest('[data-block-key]')?.getAttribute('data-block-key'),
        text: p.textContent,
        top
      }
    }
  }
  return null
}

export function readingDelta(scroller: HTMLElement, reading: Reading): number | null {
  for (const p of scroller.querySelectorAll('p')) {
    if (
      p.closest('[data-block-key]')?.getAttribute('data-block-key') === reading.key &&
      p.textContent === reading.text
    )
      return p.getBoundingClientRect().top - reading.top
  }
  return null
}
