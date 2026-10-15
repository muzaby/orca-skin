import { describe, expect, it } from 'vitest'
import {
  initialOpenCodeDetailState,
  openCodeDetailReducer,
  type OpenCodePanelSelection
} from './navigation'

describe('OpenCode upper panel selection', () => {
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
    const resized = openCodeDetailReducer(expanded, { type: 'resize', width: 650 })
    const closed = openCodeDetailReducer(resized, { type: 'close' })
    expect(closed).toEqual({ selection: null, request: 1, expanded: false, width: 650 })
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
