import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { load } from 'cheerio'
import type { NativeResource } from '../../../../../shared/native-resources'
import { CascadeBody } from '../../../shared/ui/CascadeMenu'
import { nativeResourcesMenu } from './nativeResourcesMenu'

const mcp: NativeResource = {
  id: 'server',
  name: 'MCP server',
  kind: 'mcp',
  status: 'disabled',
  enabled: false,
  canToggle: true
}
const plugin: NativeResource = {
  id: 'plugin',
  name: 'Native plugin',
  kind: 'plugin',
  status: 'enabled',
  enabled: true,
  canToggle: false
}
describe('native resource submenu projection', () => {
  it('renders configured and installed resources while disconnected with locked controls', () => {
    const items = nativeResourcesMenu(
      {
        status: 'ready',
        value: {
          state: 'disconnected',
          items: [
            { ...mcp, status: 'configured', enabled: true, canToggle: false },
            { ...plugin, status: 'installed', enabled: false }
          ]
        }
      },
      false,
      (key) => key
    )
    expect(items[0]).toMatchObject({
      items: [
        {
          label: 'MCP server',
          description: 'chat.nativeResources.configured',
          checked: true,
          disabled: true
        }
      ]
    })
    expect(items[1]).toMatchObject({
      items: [
        {
          label: 'Native plugin',
          description: 'chat.nativeResources.installed',
          checked: false,
          disabled: true
        }
      ]
    })
  })
  it('maps distinct MCP and plugin lists into checked and read-only right controls', () => {
    const items = nativeResourcesMenu(
      { status: 'ready', value: { state: 'connected', generation: 'g', items: [plugin, mcp] } },
      false,
      (key) => key
    )
    for (const [index, resource] of [mcp, plugin].entries()) {
      const item = items[index]
      expect(item.kind).toBe('submenu')
      if (item.kind !== 'submenu') throw new Error('submenu missing')
      expect(item.items[0]).toMatchObject({
        action: resource,
        checked: resource.enabled,
        disabled: !resource.canToggle
      })
      const $ = load(
        renderToStaticMarkup(
          createElement(CascadeBody<NativeResource>, {
            items,
            anchorRef: { current: null },
            onClose: () => {},
            onSelect: () => {},
            initialState: { open: [index], focus: null }
          })
        )
      )
      const row = $('[role="menuitemcheckbox"]')
      expect(row.text()).toContain(resource.name)
      expect(row.attr('aria-checked')).toBe(String(resource.enabled))
      expect(row.attr('disabled') !== undefined).toBe(!resource.canToggle)
      expect(row.find('[aria-hidden="true"]').last().attr('class')).toContain('ml-3')
    }
  })
  it('distinguishes loading, error, disconnected and empty, and locks concurrent toggles', () => {
    const views = [
      { status: 'loading' },
      { status: 'error' },
      { status: 'ready', value: { state: 'disconnected', items: [] } },
      { status: 'ready', value: { state: 'connected', items: [] } }
    ] as const
    for (const [index, view] of views.entries()) {
      const items = nativeResourcesMenu(
        view as Parameters<typeof nativeResourcesMenu>[0],
        false,
        (key) => key
      )
      expect(items[0]).toMatchObject({
        items: [
          {
            kind: 'empty',
            label: `chat.nativeResources.${['loading', 'error', 'disconnected', 'empty'][index]}`
          }
        ]
      })
    }
    expect(
      nativeResourcesMenu(
        { status: 'ready', value: { state: 'connected', items: [mcp] } },
        true,
        (key) => key
      )[0]
    ).toMatchObject({ items: [{ disabled: true }] })
  })
})
