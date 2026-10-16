import { describe, expect, it, vi } from 'vitest'
import {
  initialOpenCodeDetailState,
  openCodeDetailReducer,
  openCodePanelFallbackOrigin,
  type OpenCodePanelSelection
} from './navigation'

describe('OpenCode upper panel selection', () => {
  it('keeps a summary fallback through detail selection and clears it on close or replacement', () => {
    const fallback = {} as HTMLElement
    const querySelector = vi.fn(() => fallback)
    const closest = vi.fn(() => ({ querySelector }))
    const origin = { closest } as unknown as HTMLElement
    const opened = openCodeDetailReducer(initialOpenCodeDetailState, {
      type: 'open',
      selection: { id: 'process', selectedId: 'shell-1' },
      origin,
      fallbackOrigin: openCodePanelFallbackOrigin(origin)
    })
    expect(closest).toHaveBeenCalledWith('[data-component="opencode-session-panel"]')
    expect(querySelector).toHaveBeenCalledWith('[data-panel-focus="changes"]')
    expect(opened.origin).toBe(origin)
    expect(opened.fallbackOrigin).toBe(fallback)
    const selected = openCodeDetailReducer(opened, {
      type: 'select',
      selection: { id: 'process', selectedId: 'shell-2' }
    })
    expect(selected.fallbackOrigin).toBe(fallback)
    const closed = openCodeDetailReducer(selected, { type: 'close' })
    expect(closed.origin).toBeUndefined()
    expect(closed.fallbackOrigin).toBeUndefined()
    const replaced = openCodeDetailReducer(opened, { type: 'open', selection: { id: 'diff' } })
    expect(replaced.origin).toBeUndefined()
    expect(replaced.fallbackOrigin).toBeUndefined()
  })

  it('does not borrow a fallback from outside the originating summary', () => {
    expect(openCodePanelFallbackOrigin()).toBeUndefined()
    const origin = { closest: () => null } as unknown as HTMLElement
    expect(openCodePanelFallbackOrigin(origin)).toBeUndefined()
    const emptySummary = {
      closest: () => ({ querySelector: () => null })
    } as unknown as HTMLElement
    expect(openCodePanelFallbackOrigin(emptySummary)).toBeUndefined()
  })

  it.each<OpenCodePanelSelection>([
    { id: 'diff' },
    { id: 'subagent', selectedId: null },
    { id: 'process', selectedId: 'shell-1' },
    { id: 'source' }
  ])('opens and closes $id independently of the base tile layout', (selection) => {
    const opened = openCodeDetailReducer(initialOpenCodeDetailState, { type: 'open', selection })
    expect(opened.selection).toEqual(selection)
    expect(opened.request).toBe(1)
    const expanded = openCodeDetailReducer(opened, { type: 'expand' })
    expect(expanded.expanded).toBe(true)
    const closed = openCodeDetailReducer(expanded, { type: 'close' })
    expect(closed).toEqual({ selection: null, request: 1, expanded: false })
    expect(initialOpenCodeDetailState.selection).toBeNull()
  })

  it.each(['subagent', 'process'] as const)(
    'keeps the %s upper panel lifetime while selecting and returning to its list',
    (id) => {
      const opened = openCodeDetailReducer(initialOpenCodeDetailState, {
        type: 'open',
        selection: { id, selectedId: null }
      })
      const selected = openCodeDetailReducer(opened, {
        type: 'select',
        selection: { id, selectedId: 'item-2' }
      })
      expect(selected.selection).toEqual({ id, selectedId: 'item-2' })
      expect(selected.request).toBe(opened.request)
      const list = openCodeDetailReducer(selected, {
        type: 'select',
        selection: { id, selectedId: null }
      })
      expect(list.selection).toEqual({ id, selectedId: null })
      expect(list.request).toBe(opened.request)
    }
  )

  it('ignores stale selection from another panel and starts fresh on a new open', () => {
    const opened = openCodeDetailReducer(initialOpenCodeDetailState, {
      type: 'open',
      selection: { id: 'subagent', selectedId: null }
    })
    expect(
      openCodeDetailReducer(opened, {
        type: 'select',
        selection: { id: 'process', selectedId: 'wrong' }
      })
    ).toBe(opened)
    const replaced = openCodeDetailReducer(openCodeDetailReducer(opened, { type: 'expand' }), {
      type: 'open',
      selection: { id: 'diff' }
    })
    expect(replaced.selection).toEqual({ id: 'diff' })
    expect(replaced.expanded).toBe(false)
    expect(replaced.request).toBe(2)
  })
})
