import { useMountedRows } from './rowMount'
import { useLayoutEffect, useState, type RefObject } from 'react'
import { useVirtualizer, defaultRangeExtractor, type Virtualizer } from '@tanstack/react-virtual'
import { VIRTUAL_OVERSCAN, VIRTUAL_ROW_ESTIMATE_PX } from './limits'

// The Work request and response can share a scroller but have different offsets.
export function useVirtualRows(
  count: number,
  root: RefObject<HTMLElement | null>,
  owner: RefObject<HTMLDivElement | null>,
  mode?: 'all' | 'hidden',
  getItemKey?: (index: number) => string | number | bigint,
  estimateSize: (index: number) => number = () => VIRTUAL_ROW_ESTIMATE_PX
): Virtualizer<HTMLDivElement, Element> {
  const [margin, setMargin] = useState(0)
  useLayoutEffect(() => {
    const element = root.current,
      scroll = owner.current
    if (!element || !scroll || element === scroll) return
    const update = (): void =>
      setMargin(
        element.getBoundingClientRect().top -
          scroll.getBoundingClientRect().top +
          scroll.scrollTop -
          scroll.clientTop
      )
    update()
    const observer = new ResizeObserver(update)
    observer.observe(scroll)
    if (element.parentElement) observer.observe(element.parentElement)
    for (const child of scroll.children) observer.observe(child)
    return () => observer.disconnect()
  }, [root, owner, count])
  const list = useVirtualizer<HTMLDivElement, Element>({
    count,
    ...(getItemKey && { getItemKey }),
    rangeExtractor:
      mode === 'all'
        ? () => Array.from({ length: count }, (_, i) => i)
        : mode === 'hidden'
          ? () => []
          : defaultRangeExtractor,
    getScrollElement: () => owner.current,
    estimateSize,
    overscan: VIRTUAL_OVERSCAN,
    scrollMargin: margin
  })
  useMountedRows(list.getVirtualItems().map((item) => item.key))
  return list
}
