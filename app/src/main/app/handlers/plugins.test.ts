import { describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => ({
  ipcMain: { handle: vi.fn(), on: vi.fn() }
}))

import { parsePluginListResponse } from './plugins'

const safeConnector = {
  connectorId: 'connector-one',
  label: 'Connector One',
  origin: 'https://connector-one.example.invalid',
  pluginId: 'test-plugin',
  acceptedAuthProviders: ['test-provider'],
  connected: false,
  source: 'static' as const
}

describe('plugin list handler output boundary', () => {
  it('returns safe connector DTOs after strict output validation', () => {
    expect(parsePluginListResponse([safeConnector])).toEqual([safeConnector])
  })

  it.each([
    { ...safeConnector, secret: 'secret-value' },
    { ...safeConnector, presentation: { location: 'header', name: 'Authorization' } },
    { ...safeConnector, binding: { id: 'raw-binding' } },
    { ...safeConnector, connectionId: 'connection-id' },
    { ...safeConnector, origin: 'not-a-url' },
    { ...safeConnector, connectorId: 'Connector-One' }
  ])('rejects an unsafe or malformed host list item %#', (item) => {
    expect(() => parsePluginListResponse([item])).toThrow()
  })
})
