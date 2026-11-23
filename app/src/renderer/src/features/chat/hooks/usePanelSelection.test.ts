import { createElement, useRef } from 'react'
import { it, expect, vi, afterEach } from 'vitest'
import { installFakeDom, type FakeDom } from '../../../shared/ui/renderHarness.testfixture'
import { VirtualRowMountContext, useMountedRows } from '../../../shared/ui/virtual/rowMount'
import { installViewportSelection } from '../components/transcript/viewportSelection.testfixture'
import { usePanelSelection } from './usePanelSelection'
vi.mock('react', async (original) => ({
  ...(await original<typeof import('react')>()),
  ...(await import('../../../shared/ui/renderHarness.testfixture')).fakeHooks
}))
let dom: FakeDom
afterEach(() => {
  dom.unmount()
  vi.unstubAllGlobals()
})
function Rows({ keys, caption }: { keys: number[]; caption: string }): React.ReactElement {
  useMountedRows(keys)
  return createElement('p', { 'data-row': '' }, caption)
}
function Panel({
  keys,
  doc,
  caption
}: {
  keys: number[]
  doc: string
  caption: string
}): React.ReactElement {
  const root = useRef<HTMLDivElement>(null)
  const guard = usePanelSelection(root, doc)
  return createElement(
    'main',
    null,
    createElement(
      'div',
      // eslint-disable-next-line react-hooks/refs -- React attaches this host ref during commit.
      {
        ref: root,
        onPointerDown: guard.onPointerDown,
        'data-owner': '',
        'data-suppressed': guard.suppressed ? 'yes' : 'no'
      },
      createElement(
        VirtualRowMountContext.Provider,
        { value: guard.notify },
        createElement(Rows, { keys, caption })
      )
    ),
    createElement('aside', { 'data-other': '' }, 'other')
  )
}
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- 테스트 하네스의 반환형은 조립한 fixture에서 추론한다.
function mount() {
  dom = installFakeDom({ innerWidth: 1200, innerHeight: 800 })
  const { select, selection } = installViewportSelection(dom)
  const removed = vi.spyOn(selection, 'removeAllRanges')
  const render = (keys = [0, 1], doc = 'a', caption = 'row'): void =>
    dom.render(createElement(Panel, { keys, doc, caption }))
  render()
  const own = (): import('../../../shared/ui/renderHarness.testfixture').FakeNode =>
      dom.query('[data-row]')!,
    other = (): import('../../../shared/ui/renderHarness.testfixture').FakeNode =>
      dom.query('[data-other]')!,
    root = (): import('../../../shared/ui/renderHarness.testfixture').FakeNode =>
      dom.query('[data-owner]')!
  const inside = (): void => select(own(), 0, own(), 2)
  const down = (button = 0): void =>
    dom.act(() => (root().props.onPointerDown as (e: { button: number }) => void)({ button }))
  const suppressed = (): boolean => root().getAttribute('data-suppressed') === 'yes'
  const cancel = (): void => {
    down()
    inside()
    render([0, 1, 2])
    expect(suppressed()).toBe(true)
    expect(removed).toHaveBeenCalledTimes(1)
  }
  return { selection, inside, down, suppressed, cancel, removed, render, select, own, other }
}
it('ps1 empty selection', () => {
  const v = mount()
  v.render([1, 2])
  expect(v.removed).toHaveBeenCalledTimes(0)
})
it('ps2 both ends inside', () => {
  const v = mount()
  v.inside()
  v.render([1, 2])
  expect(v.removed).toHaveBeenCalledTimes(1)
})
it('ps3 both ends in sibling', () => {
  const v = mount()
  v.select(v.other(), 0, v.other(), 2)
  v.render([1, 2])
  expect(v.removed).toHaveBeenCalledTimes(0)
})
it('ps4 focus only inside', () => {
  const v = mount()
  v.select(v.other(), 0, v.own(), 2)
  v.render([1, 2])
  expect(v.removed).toHaveBeenCalledTimes(1)
})
it('ps5 suppressed gesture clears restored range', () => {
  const v = mount()
  v.cancel()
  v.inside()
  expect(v.removed).toHaveBeenCalledTimes(2)
})
it.each([
  ['ps6', 'pointerup'],
  ['ps7', 'pointercancel'],
  ['ps8', 'blur']
])('%s ends suppression on %s', (_, event) => {
  const v = mount()
  v.cancel()
  dom.act(() => {
    if (event === 'blur') {
      const listener = vi
        .mocked(window.addEventListener)
        .mock.calls.find(([type]) => type === 'blur')![1] as EventListener
      listener(new Event('blur'))
    } else {
      for (const listener of dom.documentListeners.get(event) ?? []) listener({})
    }
  })
  expect(v.suppressed()).toBe(false)
  v.down()
  v.inside()
  expect(v.removed).toHaveBeenCalledTimes(1)
})
it('ps9 new document resets suppression', () => {
  const v = mount()
  v.cancel()
  v.render([0, 1, 2], 'b')
  expect(v.suppressed()).toBe(false)
  v.inside()
  expect(v.removed).toHaveBeenCalledTimes(1)
})
it('ps10 secondary button preserves normal selection after cancellation', () => {
  const v = mount()
  v.down(2)
  v.inside()
  v.render([1, 2])
  expect(v.removed).toHaveBeenCalledTimes(1)
  expect(v.suppressed()).toBe(false)
})
it('ps11 removal only keeps selection', () => {
  const v = mount()
  v.inside()
  v.render([0])
  expect(v.removed).toHaveBeenCalledTimes(0)
})
it('ps12 edited content at same keys keeps selection', () => {
  const v = mount()
  v.inside()
  v.render([0, 1], 'a', 'edited')
  expect(v.removed).toHaveBeenCalledTimes(0)
})

it('ps9b document replacement and child row additions clean up the old drag in the same commit', () => {
  const v = mount()
  v.cancel()
  v.render([5, 6, 7], 'b')
  expect(v.suppressed()).toBe(false)
  v.inside()
  expect(v.removed).toHaveBeenCalledTimes(1)
  expect(v.selection.rangeCount).toBe(1)
})
it('ps9c switching documents clears remembered selection ownership', () => {
  const v = mount()
  v.inside()
  v.render([0, 1], 'b')
  v.selection.setBaseAndExtent(v.own(), 0, v.own(), 0)
  v.render([1, 2], 'b')
  expect(v.removed).not.toHaveBeenCalled()
})
it('ps13 a collapsed endpoint still belongs to the recorded selection', () => {
  const v = mount()
  v.inside()
  v.selection.setBaseAndExtent(v.own(), 0, v.own(), 0)
  v.render([1, 2])
  expect(v.removed).toHaveBeenCalledOnce()
  expect(v.selection.rangeCount).toBe(0)
})
it('ps14 a fresh caret alone does not claim the panel', () => {
  const v = mount()
  v.select(v.own(), 0, v.own(), 0)
  v.render([1, 2])
  expect(v.removed).not.toHaveBeenCalled()
  expect(v.selection.rangeCount).toBe(1)
})
it('ps15 dragging without a recorded selection suppresses the gesture on a new row', () => {
  const v = mount()
  v.down()
  v.render([1, 2])
  expect(v.suppressed()).toBe(true)
})
it('ps16 an inside selection is recognized before selectionchange', () => {
  const v = mount()
  v.selection.setBaseAndExtent(v.own(), 0, v.own(), 1)
  v.render([1, 2])
  expect(v.removed).toHaveBeenCalledOnce()
})
it('ps17 the anchor alone can belong to this panel', () => {
  const v = mount()
  v.select(v.own(), 0, v.other(), 1)
  v.render([1, 2])
  expect(v.removed).toHaveBeenCalledOnce()
})
