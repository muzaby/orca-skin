import { isValidElement, type ReactElement } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ErrorToastHost } from './ErrorToastHost'
import { errorToastStore } from '../errors/errorToastStore'

vi.mock('zustand', () => ({
  useStore: <T, R>(store: { getState(): T }, select: (state: T) => R): R => select(store.getState())
}))
vi.mock('../i18n', () => ({ useI18n: () => ({ tr: (key: string) => key }) }))
type Node = ReactElement<{
  children?: unknown
  onClick?: () => void
  className?: string
  'data-behavior'?: string
  'aria-label'?: string
  role?: string
}>
function nodes(root: unknown): Node[] {
  if (Array.isArray(root)) return root.flatMap(nodes)
  if (!isValidElement(root)) return []
  const node = root as Node
  return [node, ...nodes(node.props.children)]
}
afterEach(() => {
  for (const { id } of errorToastStore.getState().toasts) errorToastStore.getState().dismiss(id)
})
function cards(): void {
  errorToastStore.getState().push({
    id: 'page',
    title: 'loadFailed',
    detail: 'long '.repeat(50),
    origin: 'main',
    target: { kind: 'page', path: '/plugins' }
  })
  errorToastStore.getState().push({ id: 'logs', title: 'unexpected', origin: 'renderer' })
}

describe('toast body and close actions', () => {
  it.each(['page', 'logs'])('opens only the selected card target and dismisses only %s', (id) => {
    cards()
    const onOpen = vi.fn()
    const tree = nodes(ErrorToastHost({ onOpen }))
    const card = tree.find((node) => node.props.role === 'alert' && node.key === `${id}:0`)!
    const body = nodes(card).find((node) => node.props['data-behavior'] === 'toast:open')!
    expect(body.type).toBe('button')
    expect(nodes(body).filter((node) => node.type === 'button')).toHaveLength(1)
    body.props.onClick!()
    expect(onOpen).toHaveBeenCalledExactlyOnceWith(
      id === 'page' ? { kind: 'page', path: '/plugins' } : undefined
    )
    expect(errorToastStore.getState().toasts.map((toast) => toast.id)).toEqual([
      id === 'page' ? 'logs' : 'page'
    ])
  })

  it('close is a sibling button that dismisses without navigation', () => {
    cards()
    const onOpen = vi.fn()
    const card = nodes(ErrorToastHost({ onOpen })).find((node) => node.key === 'page:0')!
    const close = nodes(card).find((node) => node.props['aria-label'] === 'common.close')!
    close.props.onClick!()
    expect(onOpen).not.toHaveBeenCalled()
    expect(errorToastStore.getState().toasts.map((toast) => toast.id)).toEqual(['logs'])
  })

  it('clamps only the description and keeps the animation key responsive to a merge', () => {
    cards()
    const tree = nodes(ErrorToastHost({ onOpen: vi.fn() }))
    const paragraphs = tree.filter((node) => node.type === 'p')
    const description = paragraphs.find((node) =>
      node.props.className?.includes('text-toast-desc')
    )!
    expect(description.props.className?.split(' ')).toContain('line-clamp-8')
    expect(description.props.className).toContain('[overflow-wrap:anywhere]')
    for (const node of paragraphs.filter((node) => node !== description)) {
      expect(node.props.className).not.toContain('line-clamp')
    }
    const page = errorToastStore.getState().toasts.find((toast) => toast.id === 'page')!
    errorToastStore.setState({ toasts: [{ ...page, seq: 1 }] })
    expect(
      nodes(ErrorToastHost({ onOpen: vi.fn() })).find((node) => node.props.role === 'alert')?.key
    ).toBe('page:1')
  })
})
