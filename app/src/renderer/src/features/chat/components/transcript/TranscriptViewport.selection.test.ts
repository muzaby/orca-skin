import { describe, expect, it, vi } from 'vitest'
import type { FakeNode } from '../../../../shared/ui/renderHarness.testfixture'
import { dom, makeBlocks, mountViewport } from './viewportMount.testfixture'
import { setVirtualization } from './TranscriptViewport'
vi.mock('react', async (original) => ({
  ...(await original<typeof import('react')>()),
  ...(await import('../../../../shared/ui/renderHarness.testfixture')).fakeHooks
}))
vi.mock('@tanstack/react-virtual', async () => {
  const { useRealVirtualizerWithFakeHooks } = await import('./viewportTestBridge.testfixture')
  return { useVirtualizer: useRealVirtualizerWithFakeHooks }
})

const textOf = (node: FakeNode): string =>
  node.nodeType === 3 ? node.text : node.children.map(textOf).join('')

const cancelCount = (): number => performance.getEntriesByName('oo-selection-cancel').length

describe('TranscriptViewport.selection (0326 ΔV2 · VP-29 · AR-09 ↔ IT-09 · EP-17 · s1~s10)', () => {
  it('s1: the viewport leaves copy and keys to the browser — no copy/keydown handler, no clipboard write, no extra rows', () => {
    const write = vi.fn()
    vi.stubGlobal('navigator', { clipboard: { write, writeText: write } })
    const v = mountViewport(40)
    const before = v.mounted()
    v.select(v.part(1), 2, v.part(3), 4)
    const props = v.viewport().props
    expect(props.onCopy).toBeUndefined()
    expect(props.onCopyCapture).toBeUndefined()
    expect(props.onKeyDown).toBeUndefined()
    expect(props.onKeyDownCapture).toBeUndefined()
    expect(dom!.documentListeners.get('copy')?.size ?? 0).toBe(0)
    expect(dom!.documentListeners.get('keydown')?.size ?? 0).toBe(0)
    expect(write).not.toHaveBeenCalled()
    expect(v.mounted()).toEqual(before)
    expect(v.selection.toString()).toBe('ock 1 line one\nBlock 2 line one\nBloc')
  })

  it('s2: a selection never adds rows — selecting into the overscan edge keeps the mount set and the selection', () => {
    const v = mountViewport(2500)
    v.scrollTo(100 * 80 + 5)
    const before = v.mounted()
    const edge = before.at(-1)!
    v.select(v.part(before[1]), 1, v.part(edge), 3)
    const text = v.selection.toString()
    expect(v.mounted()).toEqual(before)
    // A range pass with the selection present (1px, same visible rows) adds no row for its ends.
    v.scrollTo(100 * 80 + 6)
    expect(v.mounted()).toEqual(before)
    expect(v.selection.rangeCount).toBe(1)
    expect(v.selection.toString()).toBe(text)
    expect(text.length).toBeGreaterThan(0)
  })

  it('s2: at the end of the list a range change without new rows unmounts the selected end row', () => {
    const v = mountViewport(2500)
    v.scrollTo(2500 * 80 - 240 - 80)
    const rows = v.mounted()
    expect(rows.slice(-6)).toEqual([2494, 2495, 2496, 2497, 2498, 2499])
    v.select(v.part(2496), 1, v.part(2494), 2)
    v.scrollTo(2500 * 80 - 240)
    expect(v.mounted().filter((i) => i > 2000)).toEqual([2495, 2496, 2497, 2498, 2499])
    expect(v.selection.rangeCount).toBe(1)
  })

  it('s2: with virtualization off a new row does not cancel the selection', () => {
    setVirtualization(false)
    const v = mountViewport(3)
    v.select(v.part(0), 1, v.part(1), 2)
    v.replace(makeBlocks(4))
    expect(v.selection.rangeCount).toBe(1)
  })

  it('s3: a scroll that mounts new rows cancels an inside selection after release (no suppression)', () => {
    const v = mountViewport(2500)
    v.select(v.part(0), 1, v.part(2), 3)
    expect(v.selection.rangeCount).toBe(1)
    const measured = cancelCount()
    v.scrollTo(200 * 80)
    expect(v.selection.rangeCount).toBe(0)
    expect(v.selection.toString()).toBe('')
    expect(cancelCount()).toBe(measured + 1)
    expect(v.viewport().getAttribute('data-selection-suppressed')).toBeNull()
  })

  it('s4: a scroll that mounts no row keeps the selection', () => {
    const v = mountViewport(2500)
    v.scrollTo(100 * 80 + 5)
    v.select(v.part(100), 1, v.part(102), 3)
    const text = v.selection.toString()
    const before = v.mounted()
    v.scrollTo(100 * 80 + 15)
    expect(v.mounted()).toEqual(before)
    expect(v.selection.toString()).toBe(text)
  })

  it('s5: a cancelled drag stays unselected until pointerup, then the next drag selects normally', () => {
    const v = mountViewport(2500)
    v.pointerDown()
    v.select(v.part(0), 1, v.part(2), 3)
    v.scrollTo(200 * 80)
    expect(v.selection.rangeCount).toBe(0)
    expect(v.viewport().getAttribute('data-selection-suppressed')).toBe('')
    expect(v.viewport().getAttribute('class')?.split(' ')).toContain('select-none')
    // Chromium keeps extending the drag from its original base while the button is held.
    const rows = v.mounted()
    v.selection.setBaseAndExtent(
      v.part(rows[1]).children[0] as never,
      0,
      v.part(rows[3]).children[0] as never,
      2
    )
    v.selectionChange()
    expect(v.selection.rangeCount).toBe(0)
    v.fireDocument('pointerup')
    expect(v.viewport().getAttribute('data-selection-suppressed')).toBeNull()
    expect(v.viewport().getAttribute('class')?.split(' ')).not.toContain('select-none')
    v.pointerDown()
    v.select(v.part(rows[1]), 0, v.part(rows[3]), 2)
    expect(v.selection.rangeCount).toBe(1)
    expect(v.selection.toString().length).toBeGreaterThan(0)
  })

  it('s5b: a secondary-button press starts no gesture — a mount cancel leaves no suppression (D-110 ⓐ)', () => {
    const v = mountViewport(2500)
    v.pointerDown(2)
    v.select(v.part(0), 1, v.part(2), 3)
    v.scrollTo(200 * 80)
    expect(v.selection.rangeCount).toBe(0)
    expect(v.viewport().getAttribute('data-selection-suppressed')).toBeNull()
    expect(v.viewport().getAttribute('class')?.split(' ')).not.toContain('select-none')
    // With no gesture, a selection made afterwards in the viewport is not cleared again.
    const rows = v.mounted()
    v.select(v.part(rows[1]), 0, v.part(rows[3]), 2)
    expect(v.selection.rangeCount).toBe(1)
  })

  it('s6: replacing the content of a row with the same key keeps the selection', () => {
    const v = mountViewport(6)
    v.select(v.part(0), 1, v.part(1), 3)
    const text = v.selection.toString()
    v.replace(makeBlocks(6, (i) => (i === 4 ? 'Block 4 edited' : `Block ${i} line one`)))
    expect(textOf(dom!.query('[data-part-key="a:4:text:0"]')!)).toBe('Block 4 edited')
    expect(v.selection.toString()).toBe(text)
  })

  it('s7: a streamed block whose row mounts cancels the selection', () => {
    const v = mountViewport(2)
    v.select(v.part(0), 1, v.part(1), 3)
    v.replace(makeBlocks(3))
    expect(dom!.query('[data-block-key="a:2:text:0"]')).not.toBeNull()
    expect(v.selection.rangeCount).toBe(0)
  })

  it('s8: a selection outside the transcript survives a row mount', () => {
    const v = mountViewport(2500, { composer: true })
    const composer = dom!.query('[data-composer]')!
    v.select(composer, 1, composer, 9)
    v.scrollTo(200 * 80)
    expect(v.selection.toString()).toBe('omposer ')
  })

  it.each(['pointercancel', 'blur', 'session'] as const)(
    's9: %s releases a suppressed gesture',
    (release) => {
      const v = mountViewport(2500)
      v.pointerDown()
      v.select(v.part(0), 1, v.part(2), 3)
      v.scrollTo(200 * 80)
      expect(v.viewport().getAttribute('data-selection-suppressed')).toBe('')
      if (release === 'pointercancel') v.fireDocument('pointercancel')
      else if (release === 'session') v.setSession('t')
      else {
        const blur = vi
          .mocked(window.addEventListener)
          .mock.calls.filter(([type]) => type === 'blur')
          .at(-1)?.[1] as () => void
        dom!.act(() => blur())
      }
      expect(v.viewport().getAttribute('data-selection-suppressed')).toBeNull()
      const rows = v.mounted()
      v.select(v.part(rows[0]), 0, v.part(rows[1]), 1)
      expect(v.selection.rangeCount).toBe(1)
    }
  )

  it('s10: rows between the selection ends are marked selected and cleared on cancel', () => {
    const v = mountViewport(2500)
    v.select(v.part(1), 1, v.part(3), 2)
    const picked = (): number[] =>
      dom!.queryAll('[data-picked]').map((n) => Number(n.getAttribute('data-picked')))
    expect(picked()).toEqual([1, 2, 3])
    v.scrollTo(200 * 80)
    expect(picked()).toEqual([])
  })
  it('s10b: rows of another session with the same block keys are not marked selected (D-110 ⓒ)', () => {
    const v = mountViewport(2500)
    v.select(v.part(1), 1, v.part(3), 2)
    const picked = (): number[] =>
      dom!.queryAll('[data-picked]').map((n) => Number(n.getAttribute('data-picked')))
    expect(picked()).toEqual([1, 2, 3])
    // The next session reuses the keys (archived messages are `x:<index>` in every session).
    v.setSession('t')
    expect(picked()).toEqual([])
  })
})
