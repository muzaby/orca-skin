import { expect, it } from 'vitest'
import { preparedResourcesView } from './preparedResourcesView'
import type { ComposerCatalogSnapshot } from '../composer/composerCatalogState'
import type { NativeResourcesView } from '../../../hooks/useNativeResources'

const configured: NativeResourcesView = {
  status: 'ready',
  value: {
    state: 'disconnected',
    items: [
      {
        id: 'file-mcp',
        name: 'File MCP',
        kind: 'mcp',
        status: 'configured',
        enabled: true,
        canToggle: false
      },
      {
        id: 'static-plugin',
        name: 'Static plugin',
        kind: 'plugin',
        status: 'installed',
        enabled: true,
        canToggle: false
      }
    ]
  }
}
const initial: ComposerCatalogSnapshot = {
  agents: { status: 'loading' },
  models: { status: 'loading' }
}

it('replaces successful empty parts while keeping the other configured kind during partial failure', () => {
  expect(preparedResourcesView(initial, configured)).toBe(configured)
  const result = preparedResourcesView(
    { ...initial, mcp: { status: 'ready', value: [] }, plugins: { status: 'error' } },
    configured
  )
  expect(result).toMatchObject({
    status: 'ready',
    value: { partial: true, items: [{ id: 'static-plugin', canToggle: false, canOpen: false }] }
  })
  if (result.status !== 'ready') throw new Error('expected ready')
  expect(result.value.items).toHaveLength(1)
})

it('keeps native status authoritative, permits only known MCP file actions and retains successful lists on retry failure', () => {
  const result = preparedResourcesView(
    {
      ...initial,
      mcp: {
        status: 'error',
        value: [
          {
            id: 'file-mcp',
            name: 'File MCP',
            kind: 'mcp',
            status: 'disabled',
            enabled: false,
            canToggle: true
          },
          {
            id: 'dynamic',
            name: 'Dynamic',
            kind: 'mcp',
            status: 'connected',
            enabled: true,
            canToggle: true
          }
        ]
      },
      plugins: { status: 'ready', value: [] }
    },
    configured
  )
  if (result.status !== 'ready') throw new Error('expected ready')
  expect(result.value.items).toMatchObject([
    { id: 'file-mcp', status: 'disabled', enabled: false, canToggle: false, canOpen: true },
    { id: 'dynamic', status: 'connected', canToggle: false, canOpen: false }
  ])
})
