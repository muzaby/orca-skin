import { describe, expect, it, vi } from 'vitest'
import { adjustPanelViewport } from '../../lib/rightPanelViewport'

describe('right panel scroll coordinates', () => {
  it('reveals an existing offscreen column including its separator, using current scroll coordinates', () => {
    const column = { getBoundingClientRect: () => ({ left: 800, right: 1168 }) }
    const viewport = {
      scrollLeft: 120,
      scrollWidth: 1104,
      clientWidth: 500,
      getBoundingClientRect: () => ({ left: 400, right: 900 }),
      querySelector: vi.fn(() => column)
    }
    adjustPanelViewport(viewport as unknown as HTMLDivElement, 'diff')
    expect(viewport.scrollLeft).toBe(388)
    expect(viewport.querySelector).toHaveBeenCalledWith('[data-panel-tiles~="diff"]')
    column.getBoundingClientRect = () => ({ left: 200, right: 568 })
    adjustPanelViewport(viewport as unknown as HTMLDivElement, 'plan')
    expect(viewport.scrollLeft).toBe(188)
  })
  it('clamps after column removal and does not scroll for background layout-preserving updates', () => {
    const viewport = { scrollLeft: 500, scrollWidth: 600, clientWidth: 500, querySelector: vi.fn() }
    adjustPanelViewport(viewport as unknown as HTMLDivElement)
    expect(viewport.scrollLeft).toBe(100)
    expect(viewport.querySelector).not.toHaveBeenCalled()
    viewport.scrollLeft = 60
    adjustPanelViewport(viewport as unknown as HTMLDivElement)
    expect(viewport.scrollLeft).toBe(60)
  })
})
