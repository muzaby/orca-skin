import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createElement, type ComponentProps } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { RightPanelTile } from './RightPanelTile'

const h = vi.hoisted(() => ({ buttons: [] as Record<string, unknown>[], calls: [] as string[] }))
vi.mock('../../../../shared/ui/Button', () => ({
  Button: (props: Record<string, unknown>) => {
    h.buttons.push(props)
    return null
  }
}))
vi.mock('../../store/chatStore', () => ({
  useChatSession: () => undefined,
  chatActions: { removeRightPanelTile: (id: string) => h.calls.push(`close:${id}`) }
}))
beforeEach(() => {
  h.buttons = []
  h.calls = []
})
describe('closing an expanded changes tile', () => {
  it.each([false, true])(
    'clears expansion before removing the tile when expanded=%s',
    (expanded) => {
      const fixture: ComponentProps<typeof RightPanelTile> = {
        id: 'diff',
        defaultLabelKey: 'chat.rightpanel.tiles.diff',
        taskTileChrome: 'standard',
        expanded,
        onToggleExpand: () => h.calls.push('restore'),
        children: 'diff content'
      }
      renderToStaticMarkup(createElement(RightPanelTile, fixture))
      const close = h.buttons.find((button) => button.leadingIcon === 'x')!
      ;(close.onClick as () => void)()
      expect(h.calls).toEqual(expanded ? ['restore', 'close:diff'] : ['close:diff'])
      expect(
        h.buttons.filter(
          (button) => button.leadingIcon === 'expand' || button.leadingIcon === 'collapse'
        )
      ).toHaveLength(0)
    }
  )
})
