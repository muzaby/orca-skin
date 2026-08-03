import { describe, expect, it } from 'vitest'
import {
  PluginConnectionConnectRequestSchema,
  PluginConnectionDisconnectRequestSchema,
  PluginConnectorInfoSchema,
  PluginListRequestSchema
} from './protocol'

describe('plugin IPC protocol', () => {
  it('accepts only an omitted list request payload', () => {
    expect(PluginListRequestSchema.safeParse(undefined).success).toBe(true)
    expect(PluginListRequestSchema.safeParse(null).success).toBe(false)
    expect(PluginListRequestSchema.safeParse({}).success).toBe(false)
  })

  it('accepts a connect request with only a valid connector and opaque binding ID', () => {
    expect(
      PluginConnectionConnectRequestSchema.safeParse({
        connectorId: 'connector-one',
        bindingId: 'binding-opaque-1'
      }).success
    ).toBe(true)
  })

  it.each([
    { connectorId: 'Connector-One', bindingId: 'binding-opaque-1' },
    { connectorId: 'connector-one', bindingId: '' },
    { connectorId: 'connector-one', bindingId: 'binding-opaque-1', url: 'https://evil.invalid' },
    { connectorId: 'connector-one', bindingId: 'binding-opaque-1', alias: 'secondary' },
    { connectorId: 'connector-one', bindingId: 'binding-opaque-1', connectionId: 'chosen-by-ui' }
  ])('rejects a malformed or expanded connect request %#', (request) => {
    expect(PluginConnectionConnectRequestSchema.safeParse(request).success).toBe(false)
  })

  it('accepts a disconnect request with only a valid connector ID', () => {
    expect(
      PluginConnectionDisconnectRequestSchema.safeParse({ connectorId: 'connector-two' }).success
    ).toBe(true)
    expect(
      PluginConnectionDisconnectRequestSchema.safeParse({
        connectorId: 'connector-two',
        connectionId: 'leaked-id'
      }).success
    ).toBe(false)
  })

  it('allows only the safe connector list DTO fields', () => {
    const safe = {
      connectorId: 'connector-one',
      label: 'Connector One',
      origin: 'https://connector-one.example.invalid',
      pluginId: 'test-plugin',
      acceptedAuthProviders: ['test-provider'],
      connected: false,
      source: 'static'
    }
    expect(PluginConnectorInfoSchema.safeParse(safe).success).toBe(true)

    for (const forbidden of [
      'secret',
      'presentation',
      'artifact',
      'binding',
      'bindingId',
      'connectionId'
    ]) {
      expect(
        PluginConnectorInfoSchema.safeParse({ ...safe, [forbidden]: 'not-for-renderer' }).success
      ).toBe(false)
    }
  })
})
