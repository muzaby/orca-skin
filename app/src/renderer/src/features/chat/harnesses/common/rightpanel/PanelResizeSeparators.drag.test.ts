// 우측 패널 경계 핸들이 끌기 훅을 거쳐 store 에 쓴다 (0325 EP-8 ④ · VP-27).
// 핸들의 mousedown 이 훅의 `startResize` 이고, 프레임마다 마지막 값이 store 동작으로 간다.
import { createElement } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  installFakeDom,
  type FakeDom,
  type FakeNode
} from '../../../../../shared/ui/renderHarness.testfixture'
import { initialChatState } from '../../../reducer/chatReducer'
import { ColumnResizeSeparator, RowSeparator } from './PanelResizeSeparators'

const actions = vi.hoisted(() => ({
  setRightPanelColWidth: vi.fn(),
  setRightPanelRowSplit: vi.fn()
}))
vi.mock('react', async (original) => ({
  ...(await original<typeof import('react')>()),
  ...(await import('../../../../../shared/ui/renderHarness.testfixture')).fakeHooks
}))
vi.mock('../../../../../shared/i18n', () => ({ useI18n: () => ({ tr: (key: string) => key }) }))
vi.mock('../../../store/chatStore', () => ({
  useChatSession: (select: (state: typeof initialChatState) => unknown) =>
    select({ ...initialChatState, rightPanelColWidths: [400] }),
  chatActions: actions
}))

let dom: FakeDom
let listeners: Map<string, Set<(event: unknown) => void>>
beforeEach(() => {
  vi.useFakeTimers()
  dom = installFakeDom({ innerWidth: 1200, innerHeight: 900 })
  listeners = new Map()
  Object.assign(window, {
    addEventListener: (type: string, listener: (event: unknown) => void) => {
      if (!listeners.has(type)) listeners.set(type, new Set())
      listeners.get(type)!.add(listener)
    },
    removeEventListener: (type: string, listener: (event: unknown) => void) =>
      listeners.get(type)?.delete(listener)
  })
  actions.setRightPanelColWidth.mockClear()
  actions.setRightPanelRowSplit.mockClear()
})
afterEach(() => {
  dom.unmount()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})
const fire = (type: string, event: Record<string, unknown> = {}): void => {
  for (const listener of [...(listeners.get(type) ?? [])]) listener(event)
}
const press = (node: FakeNode): void =>
  dom.act(() => (node.props.onMouseDown as (event: unknown) => void)({ preventDefault: () => {} }))

describe('PanelResizeSeparators 끌기 배선', () => {
  it('열 핸들 — 프레임마다 마지막 폭을 store 에 쓴다', () => {
    dom.render(
      createElement(ColumnResizeSeparator, {
        colIndex: 0,
        columnRightOf: () => 1_000,
        label: 'col'
      })
    )
    press(dom.query('[aria-label="col"]')!)
    fire('mousemove', { clientX: 650, clientY: 0 })
    fire('mousemove', { clientX: 600, clientY: 0 })
    expect(actions.setRightPanelColWidth).not.toHaveBeenCalled()
    dom.frame()
    expect(actions.setRightPanelColWidth.mock.calls).toEqual([[0, 400]])
    fire('mouseup')
  })

  it('행 핸들 — 프레임마다 마지막 비율을 store 에 쓴다', () => {
    const columnRef = { current: { getBoundingClientRect: () => ({ top: 100, height: 400 }) } }
    dom.render(createElement(RowSeparator, { col: 1, columnRef: columnRef as never }))
    press(dom.query('[aria-label="chat.rightpanel.rowResizeAria"]')!)
    fire('mousemove', { clientX: 0, clientY: 300 })
    dom.frame()
    expect(actions.setRightPanelRowSplit.mock.calls).toEqual([[1, 0.5]])
    fire('mouseup')
  })
})
