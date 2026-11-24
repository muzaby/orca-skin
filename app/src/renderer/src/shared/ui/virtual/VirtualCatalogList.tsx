import {
  useCallback,
  useLayoutEffect,
  useRef,
  type CSSProperties,
  type ReactNode,
  type RefObject
} from 'react'
import { VirtualRowMountContext } from './rowMount'
import { usePanelSelection } from './usePanelSelection'
import { useVirtualRows } from './useVirtualRows'

export interface CatalogRowPosition {
  ref: (element: HTMLLIElement | null) => void
  'data-index': number
  style: CSSProperties
}

const estimateCatalogRow = (): number => 72

interface CatalogListProps<Item> {
  items: readonly Item[]
  owner: RefObject<HTMLDivElement | null>
  documentKey: string
  keyOf: (item: Item) => string
  renderRow: (item: Item, position?: CatalogRowPosition) => ReactNode
}

export function VirtualCatalogList<Item>(props: CatalogListProps<Item>): React.JSX.Element {
  const selection = usePanelSelection(props.owner, props.documentKey)
  return (
    <VirtualRowMountContext.Provider value={selection.notify}>
      <CatalogWindow {...props} onPointerDown={selection.onPointerDown} />
    </VirtualRowMountContext.Provider>
  )
}

function CatalogWindow<Item>({
  items,
  owner,
  keyOf,
  documentKey,
  renderRow,
  onPointerDown
}: CatalogListProps<Item> & {
  onPointerDown: (event: { button: number }) => void
}): React.JSX.Element {
  const root = useRef<HTMLUListElement>(null)
  const getItemKey = useCallback((index: number) => keyOf(items[index]), [items, keyOf])
  const list = useVirtualRows(items.length, root, owner, undefined, getItemKey, estimateCatalogRow)
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
        row && typeof row.key === 'string'
          ? { items, documentKey, key: row.key, offset: scroll.scrollTop - row.start }
          : null
    }
    capture()
    scroll.addEventListener('scroll', capture)
    return () => scroll.removeEventListener('scroll', capture)
  }, [items, owner, list, documentKey, keyOf])
  return (
    <ul
      ref={root}
      onPointerDown={onPointerDown}
      className="relative m-0 list-none p-0"
      style={{ height: list.getTotalSize() }}
    >
      {list.getVirtualItems().map((row) =>
        renderRow(items[row.index], {
          ref: list.measureElement,
          'data-index': row.index,
          style: {
            position: 'absolute',
            insetInline: 0,
            top: row.start - list.options.scrollMargin,
            borderBottom: row.index + 1 < items.length ? '1px solid var(--color-border)' : undefined
          }
        })
      )}
    </ul>
  )
}
