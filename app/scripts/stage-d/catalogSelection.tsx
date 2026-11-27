import { createRoot } from 'react-dom/client'
import { flushSync } from 'react-dom'
import {
  VirtualCatalogList,
  type CatalogRowPosition
} from '@renderer/shared/ui/virtual/VirtualCatalogList'
import { frame } from './domInput'

const keyOf = (id: string): string => id
const row = (id: string, position?: CatalogRowPosition): React.JSX.Element => (
  <li
    key={id}
    {...position}
    data-item={id}
    style={{ ...position?.style, height: id === 'item-2' ? 83 : 29 }}
  >
    {id}
  </li>
)

export async function measureCatalogSelection(): Promise<unknown> {
  const host = document.createElement('div')
  host.style.cssText = 'position:fixed;inset:0;overflow:auto'
  document.body.append(host)
  const owner = { current: host }
  const root = createRoot(host)
  const initial = Array.from({ length: 300 }, (_, i) => 'item-' + i)
  const selection = document.getSelection()!
  const render = async (items: string[]): Promise<void> => {
    flushSync(() =>
      root.render(
        <>
          <div data-sibling="">outside-list</div>
          <VirtualCatalogList
            owner={owner}
            documentKey="fixture"
            items={items}
            keyOf={keyOf}
            renderRow={row}
          />
        </>
      )
    )
    await frame()
    await frame()
  }
  const find = (id: string): HTMLElement =>
    host.querySelector<HTMLElement>('[data-item="' + id + '"]')!
  const select = (node: HTMLElement): void => {
    const range = document.createRange()
    range.selectNodeContents(node)
    selection.removeAllRanges()
    selection.addRange(range)
    document.dispatchEvent(new Event('selectionchange'))
  }
  try {
    await render(initial)
    const tall = find('item-2')
    const sibling = host.querySelector<HTMLElement>('[data-sibling]')!
    select(sibling)
    const inserted = ['new-item', ...initial.slice(0, 4), ...initial.slice(5)]
    await render(inserted)
    if (selection.toString() !== 'outside-list') throw Error('catalog cleared sibling selection')
    if (
      tall !== find('item-2') ||
      find('item-3').offsetTop - tall.offsetTop !== 83 ||
      find('item-4')
    )
      throw Error('catalog row position after insert/delete')
    const first = find('item-0')
    first.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0 }))
    select(first)
    await render(['replacement', ...inserted.slice(1)])
    if (!selection.isCollapsed) throw Error('drag selection survived a new row in the same list')
    document.dispatchEvent(new PointerEvent('pointerup'))
    for (let count = 0; count < 30 && !find('item-299'); count++) {
      host.scrollTop = host.scrollHeight
      await frame()
    }
    if (!find('item-299')) throw Error('catalog last row unreachable')
    return { height: 83, outside: 'outside-list', replaced: 'replacement', last: 'item-299' }
  } finally {
    selection.removeAllRanges()
    root.unmount()
    host.remove()
  }
}
