import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react'
import { CATALOG_VIRTUALIZE_AFTER } from '../../../shared/ui/virtual/limits'
import { VirtualRowMountContext } from '../../../shared/ui/virtual/rowMount'
import {
  usePanelSelection,
  VIRTUAL_SELECTION_SCOPE
} from '../../../shared/ui/virtual/usePanelSelection'
import { useRowScrollAnchor } from '../../../shared/ui/virtual/useRowScrollAnchor'
import { useVirtualRows } from '../../../shared/ui/virtual/useVirtualRows'

interface SidebarRowsProps<Row extends { id: string }> {
  items: readonly Row[]
  documentKey: string
  renderRow: (item: Row) => ReactNode
}

const estimateSidebarRow = (): number => 30

export function SidebarRows<Row extends { id: string }>(
  props: SidebarRowsProps<Row>
): React.JSX.Element {
  if (props.items.length <= CATALOG_VIRTUALIZE_AFTER) return <>{props.items.map(props.renderRow)}</>
  return <SidebarWindow {...props} />
}

function SidebarWindow<Row extends { id: string }>(
  props: SidebarRowsProps<Row>
): React.JSX.Element {
  const root = useRef<HTMLDivElement>(null)
  const [scroller, setScroller] = useState<HTMLDivElement | null>(null)
  const owner = useMemo(() => ({ current: scroller }), [scroller])
  const attach = useCallback((element: HTMLDivElement | null): void => {
    root.current = element
    setScroller(element?.closest<HTMLDivElement>('.app-frame-sidebar-scroll') ?? null)
  }, [])
  const selection = usePanelSelection(owner, props.documentKey, root)
  return (
    <VirtualRowMountContext.Provider value={selection.notify}>
      <SidebarWindowRows
        {...props}
        root={root}
        owner={owner}
        attach={attach}
        onPointerDown={selection.onPointerDown}
      />
    </VirtualRowMountContext.Provider>
  )
}

function SidebarWindowRows<Row extends { id: string }>({
  items,
  documentKey,
  renderRow,
  root,
  owner,
  attach,
  onPointerDown
}: SidebarRowsProps<Row> & {
  root: React.RefObject<HTMLDivElement | null>
  owner: React.RefObject<HTMLDivElement | null>
  attach: (element: HTMLDivElement | null) => void
  onPointerDown: (event: { button: number }) => void
}): React.JSX.Element {
  const getItemKey = useCallback((index: number) => items[index].id, [items])
  const list = useVirtualRows(items.length, root, owner, undefined, getItemKey, estimateSidebarRow)
  useRowScrollAnchor(list, owner, items, documentKey, sidebarRowId)
  return (
    <div
      ref={attach}
      data-virtual-selection-scope=""
      onPointerDown={(event) => {
        if (
          event.target instanceof Element &&
          event.target.closest(VIRTUAL_SELECTION_SCOPE) === event.currentTarget
        )
          onPointerDown(event)
      }}
      className="relative shrink-0"
      style={{ height: list.getTotalSize() }}
    >
      {list.getVirtualItems().map((row) => (
        <div
          key={row.key}
          ref={list.measureElement}
          data-index={row.index}
          className="absolute inset-x-0"
          style={{ top: row.start - list.options.scrollMargin }}
        >
          {renderRow(items[row.index])}
        </div>
      ))}
    </div>
  )
}

function sidebarRowId(item: { id: string }): string {
  return item.id
}
