import { describe, expect, it } from 'vitest'
import type {
  ConnectorRuntimeV1,
  ConnectorStatus
} from '../../contracts/connector-plugin'
import { ConnectionRegistry } from './registry'
import { ConnectorHost } from './runtime'

function connector(
  id: string,
  start: () => Promise<ConnectorStatus> = async () => ({ health: 'ready' })
): ConnectorRuntimeV1 {
  return {
    descriptor: {
      id,
      pluginId: 'test-plugin',
      apiVersion: 1,
      label: id,
      acceptedAuthProviders: ['test-auth'],
      baseUrl: 'https://connector.example.invalid',
      presentation: { location: 'header', name: 'Authorization', scheme: 'Bearer' }
    },
    start: async () => start(),
    invoke: async () => ({ ok: true, data: null }),
    stop: async () => undefined
  }
}

function hostWith(...connectors: ConnectorRuntimeV1[]): {
  registry: ConnectionRegistry
  host: ConnectorHost
} {
  const registry = new ConnectionRegistry(() => 123)
  const byId = new Map(connectors.map((entry) => [entry.descriptor.id, entry]))
  return {
    registry,
    host: new ConnectorHost({
      connections: registry,
      lookup: { getConnector: (connectorId) => byId.get(connectorId) },
      authenticatedFetch: async () => ({ status: 200, headers: {}, body: '' })
    })
  }
}

describe('static connector connection registry', () => {
  it('preserves the caller-supplied connection ID', () => {
    const registry = new ConnectionRegistry(() => 123)

    const connection = registry.create({
      id: 'binding-connection-1',
      connectorId: 'jira-engineering',
      bindingId: 'binding-1'
    })

    expect(connection).toMatchObject({
      id: 'binding-connection-1',
      connectorId: 'jira-engineering',
      bindingId: 'binding-1'
    })
  })

  it('rejects a duplicate connection ID', () => {
    const registry = new ConnectionRegistry()
    registry.create({ id: 'connection-1', connectorId: 'jira-engineering', bindingId: 'binding-1' })

    expect(() =>
      registry.create({ id: 'connection-1', connectorId: 'confluence-engineering', bindingId: 'binding-2' })
    ).toThrow(/connection ID/i)
  })

  it('rejects a second connection for one static connector without replacing the first', () => {
    const registry = new ConnectionRegistry()
    const first = registry.create({
      id: 'connection-1',
      connectorId: 'jira-engineering',
      bindingId: 'binding-1'
    })

    expect(() =>
      registry.create({
        id: 'connection-2',
        connectorId: 'jira-engineering',
        bindingId: 'binding-2'
      })
    ).toThrow(/static connector/i)
    expect(registry.listByConnector('jira-engineering')).toEqual([first])
  })

  it('allows different static connectors to coexist', () => {
    const registry = new ConnectionRegistry()
    registry.create({ id: 'jira-connection', connectorId: 'jira-engineering', bindingId: 'binding-1' })
    registry.create({
      id: 'confluence-connection',
      connectorId: 'confluence-engineering',
      bindingId: 'binding-2'
    })

    expect(registry.list()).toHaveLength(2)
  })
})

describe('ConnectorHost.connect', () => {
  it('creates and starts the caller-supplied connection ID when the connector is ready', async () => {
    let starts = 0
    const { registry, host } = hostWith(
      connector('jira-engineering', async () => {
        starts += 1
        return { health: 'ready' }
      })
    )

    await expect(
      host.connect({
        id: 'binding-connection-1',
        connectorId: 'jira-engineering',
        bindingId: 'binding-1'
      })
    ).resolves.toEqual({ health: 'ready' })

    expect(starts).toBe(1)
    expect(registry.get('binding-connection-1')).toMatchObject({
      id: 'binding-connection-1',
      connectorId: 'jira-engineering'
    })
    expect(host.isStarted('binding-connection-1')).toBe(true)
  })

  it('rolls back the newly created connection when start is not ready', async () => {
    const { registry, host } = hostWith(
      connector('jira-engineering', async () => ({ health: 'unreachable', message: 'offline' }))
    )

    await expect(
      host.connect({ id: 'connection-1', connectorId: 'jira-engineering', bindingId: 'binding-1' })
    ).resolves.toEqual({ health: 'unreachable', message: 'offline' })

    expect(registry.get('connection-1')).toBeUndefined()
    expect(host.isStarted('connection-1')).toBe(false)
  })

  it('rolls back the newly created connection when start throws', async () => {
    const { registry, host } = hostWith(
      connector('jira-engineering', async () => {
        throw new Error('offline')
      })
    )

    await expect(
      host.connect({ id: 'connection-1', connectorId: 'jira-engineering', bindingId: 'binding-1' })
    ).resolves.toMatchObject({ health: 'error' })

    expect(registry.get('connection-1')).toBeUndefined()
    expect(host.isStarted('connection-1')).toBe(false)
  })
})
