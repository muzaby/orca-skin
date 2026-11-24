import { useLayoutEffect, useRef, type RefObject } from 'react'
import type { Virtualizer } from '@tanstack/react-virtual'

export function useRowScrollAnchor<Item>(
  list: Virtualizer<HTMLDivElement, Element>,
  owner: RefObject<HTMLDivElement | null>,
  items: readonly Item[],
  documentKey: string,
  keyOf: (item: Item) => string
): void {
  const anchor = useRef<{
    items: readonly Item[]
    documentKey: string
    key: string
    offset: number
  } | null>(null)

  useLayoutEffect(() => {
    const scroll = owner.current
    if (!scroll) return
    const previous = anchor.current
    if (previous && previous.items !== items && previous.documentKey === documentKey) {
      const index = items.findIndex((item) => keyOf(item) === previous.key)
      const target = index < 0 ? undefined : list.getOffsetForIndex(index, 'start')
      if (target) list.scrollToOffset(target[0] + previous.offset)
    }
    const capture = (): void => {
      const row = list.getVirtualItemForOffset(scroll.scrollTop)
      anchor.current =
        row &&
        row.start <= scroll.scrollTop &&
        scroll.scrollTop < row.end &&
        typeof row.key === 'string'
          ? { items, documentKey, key: row.key, offset: scroll.scrollTop - row.start }
          : null
    }
    capture()
    scroll.addEventListener('scroll', capture)
    return () => scroll.removeEventListener('scroll', capture)
  }, [items, owner, list, documentKey, keyOf])
}
