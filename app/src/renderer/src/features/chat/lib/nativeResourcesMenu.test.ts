import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { load } from 'cheerio'
import type { NativeResource } from '../../../../../shared/native-resources'
import { CascadeBody } from '../../../shared/ui/CascadeMenu'
import { nativeResourcesMenu, type NativeResourcesAction } from './nativeResourcesMenu'
import type { NativeResourcesView } from './nativeResourceState'
const mcp: NativeResource = {
  id: 'server',
  name: 'MCP server',
  kind: 'mcp',
  status: 'connected',
  enabled: true,
  canToggle: true
}
const plugin: NativeResource = {
  id: 'plugin',
  name: 'Native plugin',
  description: 'Workflow skills',
  kind: 'plugin',
  status: 'enabled',
  enabled: true,
  canToggle: false
}
const projection = (
  items: NativeResource[],
  pending = new Set<string>()
): ReturnType<typeof nativeResourcesMenu> =>
  nativeResourcesMenu(
    { status: 'ready', value: { state: 'connected', generation: 'g', items } },
    pending,
    (key) => key
  )
function render(items: ReturnType<typeof projection>, index: number): ReturnType<typeof load> {
  return load(
    renderToStaticMarkup(
      createElement(CascadeBody<NativeResourcesAction>, {
        items,
        anchorRef: { current: null },
        onClose: () => {},
        onSelect: () => {},
        initialState: { open: [index], focus: null }
      })
    )
  )
}
describe('native resource submenu projection', () => {
  it('maps distinct MCP and plugin lists, official MCP mark, folder actions and status balls without subtitles', () => {
    const items = projection([plugin, mcp])
    expect(items[0]).toMatchObject({
      icon: 'mcp',
      disabled: false,
      items: [{ label: 'MCP server', action: { type: 'toggle', resource: mcp } }]
    })
    expect(items[1]).toMatchObject({
      icon: 'electricalServices',
      disabled: false,
      items: [{ label: 'Native plugin', action: { type: 'open', resource: plugin } }]
    })
    for (const [index, resource] of [mcp, plugin].entries()) {
      const $ = render(items, index)
      expect($('[data-brand="mcp"]')).toHaveLength(1)
      const row = $('[data-cascade-level="1"][data-cascade-index="0"]')
      expect(row.text()).toBe(resource.name)
      expect(row.attr('disabled')).toBeUndefined()
      expect(row.attr('aria-checked')).toBeUndefined()
      expect(row.prev().find('[data-status-tone="green"]')).toHaveLength(1)
      if (resource.kind === 'mcp') expect(row.prev().attr('aria-checked')).toBe('true')
      else expect(row.attr('title')).toBe('Workflow skills\nchat.nativeResources.openFolder')
    }
  })
  it('disables empty groups and renders no open panel for loading, errors or empty results', () => {
    const views: NativeResourcesView[] = [
      { status: 'loading' },
      { status: 'error' },
      { status: 'ready', value: { state: 'disconnected', items: [] } },
      { status: 'ready', value: { state: 'connected', items: [] } }
    ]
    for (const view of views) {
      const items = nativeResourcesMenu(view, new Set(), (key) => key)
      expect(items).toMatchObject([
        { disabled: true, items: [] },
        { disabled: true, items: [] }
      ])
      for (const index of [0, 1]) {
        const $ = render(items, index)
        expect($('[data-cascade-level="1"]')).toHaveLength(0)
        expect($('[aria-haspopup]')).toHaveLength(0)
        expect($('button:disabled')).toHaveLength(2)
      }
    }
  })
  it.each([
    ['connected', 'green'],
    ['enabled', 'green'],
    ['disabled', 'slate'],
    ['configured', 'slate'],
    ['installed', 'slate'],
    ['needs-auth', 'amber'],
    ['pending', 'amber'],
    ['failed', 'red']
  ] as const)('represents %s only through an accessible %s status ball', (status, tone) => {
    const items = projection([{ ...mcp, status, canToggle: false }])
    const $ = render(items, 0)
    expect($('[data-status-tone]').attr('data-status-tone')).toBe(tone)
    expect($('[role="img"]').attr('aria-label')).toBe(`MCP server: chat.nativeResources.${status}`)
    expect($('[data-cascade-level="1"]').text()).toBe('MCP server')
  })
  it('shows progress only inside the active resource ball and leaves other actions enabled', () => {
    const items = projection([mcp, { ...mcp, id: 'other', name: 'Other' }], new Set(['mcp:server']))
    const $ = render(items, 0)
    expect($('[data-status-spinner]')).toHaveLength(1)
    expect($('[data-status-spinner]').attr('class')).toContain('motion-reduce:animate-none')
    const controls = $('[role="menuitemcheckbox"]')
    expect(controls.eq(0).attr('aria-busy')).toBe('true')
    expect(controls.eq(0).attr('disabled')).toBeDefined()
    expect(controls.eq(1).attr('disabled')).toBeUndefined()
    expect($('[data-cascade-level="1"][disabled]')).toHaveLength(0)
  })
})
