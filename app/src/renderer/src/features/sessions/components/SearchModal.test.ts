import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { isValidElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import type { SearchHit } from '../../../../../shared/ipc'
import { SearchModal } from './SearchModal'

const h = vi.hoisted(() => ({
  states: [] as unknown[],
  refs: [] as { current: unknown }[],
  cursor: 0,
  refCursor: 0,
  effects: [] as (() => void | (() => void))[],
  search: vi.fn(),
  navigate: vi.fn(),
  close: vi.fn()
}))
vi.mock('react', async (original) => ({
  ...(await original<typeof import('react')>()),
  useState: (initial: unknown) => {
    const index = h.cursor++
    if (!(index in h.states)) h.states[index] = initial
    return [
      h.states[index],
      (value: unknown) => {
        h.states[index] = typeof value === 'function' ? value(h.states[index]) : value
      }
    ]
  },
  useRef: (initial: unknown) =>
    h.refs[h.refCursor++] ?? (h.refs[h.refCursor - 1] = { current: initial }),
  useCallback: (fn: unknown) => fn,
  useEffect: (effect: () => void | (() => void)) => h.effects.push(effect)
}))
vi.mock('../../../shared/api/ipc', () => ({ searchApi: { messages: h.search } }))
vi.mock('../../../shared/i18n', () => ({ useI18n: () => ({ tr: (key: string) => key }) }))

function render(): ReturnType<typeof SearchModal> {
  h.cursor = 0
  h.refCursor = 0
  h.effects = []
  return SearchModal({ onClose: h.close, onChoose: h.navigate })
}
type ElementProps = {
  children?: ReactNode
  onChange?: (event: { target: { value: string } }) => void
  onKeyDown?: (event: { key: string; preventDefault: () => void }) => void
} & Record<string, unknown>
type TestElement = { type: unknown; props: ElementProps }

function elements(node: ReactNode): TestElement[] {
  if (Array.isArray(node)) return node.flatMap(elements)
  if (!isValidElement<ElementProps>(node)) return []
  return [node, ...elements(node.props.children)]
}
function input(): TestElement {
  return elements(render()).find((el) => el.type === 'input')!
}
function query(value: string): void | (() => void) {
  input().props.onChange!({ target: { value } })
  render()
  return h.effects[0]()
}
const hit = (sessionId: string): SearchHit => ({
  messageId: sessionId === 'a' ? 1 : 2,
  sessionId,
  role: 'assistant',
  snippet: '<script>unsafe</script> <mark>answer</mark>',
  sessionTitle: 'title',
  createdAt: 0
})
function deferred(): { promise: Promise<SearchHit[]>; resolve: (rows: SearchHit[]) => void } {
  let resolve!: (rows: SearchHit[]) => void
  const promise = new Promise<SearchHit[]>((done) => {
    resolve = done
  })
  return { promise, resolve }
}
beforeEach(() => {
  h.states = []
  h.refs = []
  h.effects = []
  h.search.mockReset()
  h.navigate.mockReset()
  h.close.mockReset()
  vi.useFakeTimers()
  vi.stubGlobal('window', { setTimeout, clearTimeout })
  vi.stubGlobal('document', new EventTarget())
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('actual search modal before and after responsibility relocation', () => {
  it('preserves debounce, empty-query skip and out-of-order response rejection', async () => {
    const a = deferred()
    const b = deferred()
    h.search.mockReturnValueOnce(a.promise).mockReturnValueOnce(b.promise)
    query('   ')
    await vi.advanceTimersByTimeAsync(200)
    expect(h.search).not.toHaveBeenCalled()
    const cleanup = query('  first  ')
    await vi.advanceTimersByTimeAsync(149)
    expect(h.search).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)
    expect(h.search).toHaveBeenLastCalledWith('first', 30)
    cleanup?.()
    query('second')
    await vi.advanceTimersByTimeAsync(150)
    b.resolve([hit('b')])
    await b.promise
    a.resolve([hit('a')])
    await a.promise
    expect(h.states[1]).toEqual([hit('b')])
  })

  it('keeps arrow selection, navigation-before-close and escaped snippet output', () => {
    h.states = ['query', [hit('a'), hit('b')], 0]
    const preventDefault = vi.fn()
    input().props.onKeyDown!({ key: 'ArrowDown', preventDefault })
    input().props.onKeyDown!({ key: 'ArrowDown', preventDefault })
    expect(h.states[2]).toBe(1)
    input().props.onKeyDown!({ key: 'ArrowUp', preventDefault })
    expect(h.states[2]).toBe(0)
    input().props.onKeyDown!({ key: 'Enter', preventDefault })
    expect(h.navigate).toHaveBeenCalledExactlyOnceWith('a')
    expect(h.navigate.mock.invocationCallOrder[0]).toBeLessThan(h.close.mock.invocationCallOrder[0])
    const result = elements(render()).find(
      (el) => typeof el.type === 'function' && el.type.name === 'SearchResults'
    )!
    const resultElement = (result.type as (props: ElementProps) => ReactNode)(result.props)
    const html = renderToStaticMarkup(resultElement)
    expect(html).toContain('&lt;script&gt;unsafe&lt;/script&gt;')
    expect(html).toContain('<mark class="bg-rust-soft text-rust">answer</mark>')
  })

  it('closes on outside mousedown and Escape and removes both listeners on cleanup', () => {
    render()
    const cleanup = h.effects[1]()
    const inside = new Event('mousedown')
    h.refs[1].current = { contains: (target: unknown) => target === document }
    document.dispatchEvent(inside)
    expect(h.close).not.toHaveBeenCalled()
    h.refs[1].current = { contains: () => false }
    document.dispatchEvent(new Event('mousedown'))
    const escape = new Event('keydown')
    Object.defineProperty(escape, 'key', { value: 'Escape' })
    document.dispatchEvent(escape)
    expect(h.close).toHaveBeenCalledTimes(2)
    cleanup?.()
    document.dispatchEvent(new Event('mousedown'))
    document.dispatchEvent(escape)
    expect(h.close).toHaveBeenCalledTimes(2)
  })
})
