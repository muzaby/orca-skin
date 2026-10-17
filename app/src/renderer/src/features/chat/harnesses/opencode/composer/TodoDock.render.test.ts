import { createElement } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  installFakeDom,
  type FakeDom,
  type FakeNode
} from '../../../../../shared/ui/renderHarness.testfixture'
import { OpenCodeTodoDock, type OpenCodeTodoDockProps } from './TodoDock'

vi.mock('react', async (original) => ({
  ...(await original<typeof import('react')>()),
  ...(await import('../../../../../shared/ui/renderHarness.testfixture')).fakeHooks
}))
vi.mock('../../../../../shared/i18n', () => ({ useI18n: () => ({ tr: (key: string) => key }) }))

const all = (node: FakeNode): FakeNode[] => [node, ...node.children.flatMap(all)]
let dom: FakeDom
let props: OpenCodeTodoDockProps
let reduced: boolean
const render = (patch: Partial<OpenCodeTodoDockProps> = {}): void => {
  props = { ...props, ...patch }
  dom.render(createElement(OpenCodeTodoDock, props))
}
const region = (): FakeNode | null => dom.query('[data-slot="opencode-todo-region"]')
const progress = (): number => Number(region()?.props['data-progress'])
beforeEach(() => {
  vi.useFakeTimers()
  reduced = false
  dom = installFakeDom({
    innerWidth: 900,
    innerHeight: 800,
    layout: (node) => {
      if (node.props['data-slot'] !== 'opencode-todo-dock') return undefined
      const expanded = all(node).some((child) => child.props['data-slot'] === 'todo-list')
      return { rect: { left: 0, top: 0, width: 400, height: expanded ? 150 : 78 } }
    }
  })
  window.matchMedia = (() => ({
    matches: reduced,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn()
  })) as unknown as typeof window.matchMedia
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe = vi.fn()
      disconnect = vi.fn()
    }
  )
  props = {
    sessionKey: 'A',
    turnKey: 1,
    live: true,
    blocked: false,
    collapsed: false,
    todos: [
      { text: 'first', status: 'in_progress' },
      { text: 'second', status: 'pending' }
    ],
    onCollapsedChange: (collapsed) => render({ collapsed })
  }
})
afterEach(() => {
  dom.unmount()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('OpenCode TodoDock actual DOM lifecycle', () => {
  it('expands upward using measured height and overlap, keeps a collapsed summary through updates', () => {
    render()
    expect(progress()).toBe(0)
    dom.advance(160)
    expect(progress()).toBeGreaterThan(0)
    expect(progress()).toBeLessThan(1)
    dom.advance(160)
    expect(progress()).toBe(1)
    expect(region()?.props.style).toMatchObject({ height: 150, marginBottom: -36 })
    const toggle = dom.query('[data-slot="todo-toggle"]')!
    expect(toggle.props['aria-expanded']).toBe(true)
    dom.click(toggle)
    expect(dom.query('[data-slot="todo-list"]')).toBeNull()
    expect(dom.query('[data-slot="todo-summary"]')?.textContent).toBe('first')
    expect(region()?.props.style).toMatchObject({ height: 78, marginBottom: -36 })
    render({ todos: [{ text: 'second', status: 'in_progress' }] })
    expect(dom.query('[data-slot="todo-summary"]')?.textContent).toBe('second')
    expect(dom.query('[data-slot="todo-toggle"]')?.props['aria-expanded']).toBe(false)
    dom.click(dom.query('[data-slot="todo-toggle"]')!)
    expect(dom.query('[data-slot="todo-list"]')).not.toBeNull()
  })
  it('waits 400ms for terminal work, then exits downward over 300ms without a blank snapshot or live controls', () => {
    render()
    dom.advance(320)
    render({
      todos: [
        { text: 'finished', status: 'completed' },
        { text: 'cancelled', status: 'cancelled' }
      ]
    })
    expect(dom.query('[data-slot="todo-count"]')?.textContent).toBe('1/2')
    dom.advance(399)
    expect(progress()).toBe(1)
    dom.advance(1)
    expect(region()?.props.style).toMatchObject({ pointerEvents: 'none' })
    expect(dom.query('[data-slot="todo-toggle"]')?.props.disabled).toBe(true)
    dom.advance(144)
    expect(progress()).toBeGreaterThan(0)
    expect(progress()).toBeLessThan(1)
    expect(dom.query('[data-slot="opencode-todo-dock"]')?.textContent).toContain('finished')
    const transform = String(
      (dom.query('[data-slot="opencode-todo-dock"]')?.props.style as { transform: string })
        .transform
    )
    expect(transform).toMatch(/^translateY\([1-9]/)
    dom.advance(176)
    expect(region()).toBeNull()
  })
  it('retains the last snapshot through simultaneous idle/empty and immediately clears a different session/turn', () => {
    render()
    dom.advance(320)
    render({ todos: [], live: false })
    expect(dom.query('[data-slot="opencode-todo-dock"]')?.textContent).toContain('first')
    dom.advance(320)
    expect(region()).toBeNull()
    render({ turnKey: 2, live: true })
    expect(region()).toBeNull()
    render({ todos: [{ text: 'new', status: 'pending' }] })
    dom.advance(320)
    render({ sessionKey: 'B', todos: [] })
    expect(region()).toBeNull()
  })
  it('cancels old close timers on unfinished updates and hides/restores around requests', () => {
    render({ collapsed: true })
    dom.advance(320)
    render({ todos: [{ text: 'done', status: 'completed' }] })
    dom.advance(300)
    render({ todos: [{ text: 'resumed', status: 'pending' }] })
    dom.advance(500)
    expect(progress()).toBe(1)
    expect(dom.query('[data-slot="todo-summary"]')?.textContent).toBe('resumed')
    render({ todos: [{ text: 'done again', status: 'completed' }] })
    dom.advance(400)
    dom.advance(144)
    expect(progress()).toBeLessThan(1)
    render({ todos: [{ text: 'resumed', status: 'in_progress' }] })
    dom.advance(320)
    expect(progress()).toBe(1)
    render({ blocked: true })
    expect(region()).toBeNull()
    dom.advance(500)
    render({ blocked: false })
    dom.advance(320)
    expect(dom.query('[data-slot="todo-summary"]')?.textContent).toBe('resumed')
    expect(dom.query('[data-slot="todo-list"]')).toBeNull()
  })
  it('shows reduced-motion results immediately and cancels scheduled work when unmounted', () => {
    reduced = true
    render()
    expect(progress()).toBe(1)
    render({ todos: [{ text: 'done', status: 'completed' }] })
    expect(region()).toBeNull()
    render({ todos: [{ text: 'new', status: 'pending' }] })
    expect(progress()).toBe(1)
    dom.unmount()
    expect(vi.getTimerCount()).toBe(0)
  })
  it('does not reuse an expired closure after switching sessions and returning', () => {
    render()
    dom.advance(320)
    render({ todos: [{ text: 'finished', status: 'completed' }] })
    dom.advance(400)
    dom.advance(320)
    expect(region()).toBeNull()
    render({ sessionKey: 'B', todos: [] })
    render({ sessionKey: 'A', todos: [{ text: 'resumed', status: 'pending' }] })
    dom.advance(320)
    render({ todos: [{ text: 'new completion', status: 'completed' }] })
    dom.advance(399)
    expect(progress()).toBe(1)
    dom.advance(1)
    dom.advance(320)
    expect(region()).toBeNull()
  })
})
