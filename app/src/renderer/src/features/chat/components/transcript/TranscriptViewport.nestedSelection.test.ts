import { createElement } from 'react'
import { expect, it, vi } from 'vitest'
import { dom, mountViewport } from './viewportMount.testfixture'
import { useMountedRows } from '../../../../shared/ui/virtual/rowMount'
vi.mock('react', async (original) => ({
  ...(await original<typeof import('react')>()),
  ...(await import('../../../../shared/ui/renderHarness.testfixture')).fakeHooks
}))
vi.mock('@tanstack/react-virtual', async () => {
  const { useRealVirtualizerWithFakeHooks } = await import('./viewportTestBridge.testfixture')
  return { useVirtualizer: useRealVirtualizerWithFakeHooks }
})

function Card({ keys }: { keys: number[] }): null {
  useMountedRows(keys)
  return null
}
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- 테스트 하네스의 반환형은 조립한 fixture에서 추론한다.
function mount() {
  let keys = [0]
  const v = mountViewport(20, { composer: true, nested: () => createElement(Card, { keys }) })
  const before = v.mounted()
  const add = (): void => {
    keys = [0, 1]
    v.render()
    expect(v.mounted()).toEqual(before)
  }
  return { ...v, add }
}
it('tn1 nested mount clears inside selection and decoration', () => {
  const v = mount()
  v.select(v.part(0), 0, v.part(1), 2)
  expect(dom!.queryAll('[data-picked]').length).toBe(2)
  v.add()
  expect(v.selection.rangeCount).toBe(0)
  expect(dom!.queryAll('[data-picked]')).toHaveLength(0)
})
it('tn2 sibling selection survives', () => {
  const v = mount(),
    other = dom!.query('[data-composer]')!
  v.select(other, 0, other, 3)
  v.add()
  expect(v.selection.toString()).toBe('com')
})
it('tn3 no selection causes no range removal', () => {
  const v = mount(),
    removed = vi.spyOn(v.selection, 'removeAllRanges')
  v.add()
  expect(removed).not.toHaveBeenCalled()
})
it('tn4 nested mount suppresses active drag', () => {
  const v = mount()
  v.pointerDown()
  v.select(v.part(0), 0, v.part(1), 2)
  v.add()
  expect(v.viewport().getAttribute('data-selection-suppressed')).toBe('')
  expect(v.selection.rangeCount).toBe(0)
})
