import { useCallback, useRef, type CSSProperties, type ReactNode, type RefObject } from 'react'
import { VirtualRowMountContext } from './rowMount'
import { usePanelSelection, VIRTUAL_SELECTION_SCOPE } from './usePanelSelection'
import { useRowScrollAnchor } from './useRowScrollAnchor'
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
  const root = useRef<HTMLUListElement>(null)
  const selection = usePanelSelection(props.owner, props.documentKey, root)
  return (
    <VirtualRowMountContext.Provider value={selection.notify}>
      <CatalogWindow {...props} root={root} onPointerDown={selection.onPointerDown} />
    </VirtualRowMountContext.Provider>
  )
}

function CatalogWindow<Item>({
  items,
  owner,
  keyOf,
  documentKey,
  renderRow,
  root,
  onPointerDown
}: CatalogListProps<Item> & {
  root: RefObject<HTMLUListElement | null>
  onPointerDown: (event: { button: number }) => void
}): React.JSX.Element {
  const getItemKey = useCallback((index: number) => keyOf(items[index]), [items, keyOf])
  const list = useVirtualRows(items.length, root, owner, undefined, getItemKey, estimateCatalogRow)
  useRowScrollAnchor(list, owner, items, documentKey, keyOf)
  return (
    <ul
      ref={root}
      data-virtual-selection-scope=""
      onPointerDown={(event) => {
        if (
          event.target instanceof Element &&
          event.target.closest(VIRTUAL_SELECTION_SCOPE) === event.currentTarget
        )
          onPointerDown(event)
      }}
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
