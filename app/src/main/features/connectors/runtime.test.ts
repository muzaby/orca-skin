import { describe, expect, it } from 'vitest'
import type { ConnectorRuntimeV1, ConnectorStatus } from '../../contracts/connector-plugin'
import { ConnectionRegistry } from './registry'
import { ConnectorHost } from './runtime'

function connector(
  id: string,
  start: () => Promise<ConnectorStatus> = async () => ({ health: 'ready' }),
  stop: () => Promise<void> = async () => undefined
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
    stop: async () => stop()
  }
}

function deferred<T>(): {
  promise: Promise<T>
  resolve: (value: T | PromiseLike<T>) => void
  reject: (reason?: unknown) => void
} {
  let resolve!: (value: T | PromiseLike<T>) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, resolve, reject }
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
      registry.create({
        id: 'connection-1',
        connectorId: 'confluence-engineering',
        bindingId: 'binding-2'
      })
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
    registry.create({
      id: 'jira-connection',
      connectorId: 'jira-engineering',
      bindingId: 'binding-1'
    })
    registry.create({
      id: 'confluence-connection',
      connectorId: 'confluence-engineering',
      bindingId: 'binding-2'
    })

    expect(registry.list()).toHaveLength(2)
  })
})

describe('ConnectorHost.connect', () => {
  it('forwards a caller cancellation signal into a pending connector start', async () => {
    let startSignal: AbortSignal | undefined
    const startEntered = deferred<void>()
    const { registry, host } = hostWith({
      descriptor: {
        id: 'jira-engineering',
        pluginId: 'test-plugin',
        apiVersion: 1,
        label: 'jira-engineering',
        acceptedAuthProviders: ['test-auth'],
        baseUrl: 'https://connector.example.invalid',
        presentation: { location: 'header', name: 'Authorization', scheme: 'Bearer' }
      },
      start: async (ctx) => {
        startSignal = ctx.signal
        startEntered.resolve()
        return new Promise((resolve) => {
          ctx.signal.addEventListener('abort', () => resolve({ health: 'error' }), { once: true })
        })
      },
      invoke: async () => ({ ok: true, data: null }),
      stop: async () => undefined
    })
    registry.create({ id: 'connection-1', connectorId: 'jira-engineering', bindingId: 'binding-1' })
    const caller = new AbortController()

    const starting = host.start('connection-1', caller.signal)
    await startEntered.promise

    expect(startSignal).toBeDefined()
    caller.abort()
    await expect(starting).resolves.toEqual({ health: 'error' })
    expect(startSignal?.aborted).toBe(true)
  })

  it('composes caller cancellation with the local invoke timeout signal', async () => {
    let invokeSignal: AbortSignal | undefined
    const invokeEntered = deferred<void>()
    const { registry, host } = hostWith({
      descriptor: {
        id: 'jira-engineering',
        pluginId: 'test-plugin',
        apiVersion: 1,
        label: 'jira-engineering',
        acceptedAuthProviders: ['test-auth'],
        baseUrl: 'https://connector.example.invalid',
        presentation: { location: 'header', name: 'Authorization', scheme: 'Bearer' }
      },
      start: async () => ({ health: 'ready' }),
      invoke: async (ctx) => {
        invokeSignal = ctx.signal
        invokeEntered.resolve()
        return new Promise((resolve) => {
          ctx.signal.addEventListener('abort', () => resolve({ ok: true, data: null }), {
            once: true
          })
        })
      },
      stop: async () => undefined
    })
    registry.create({ id: 'connection-1', connectorId: 'jira-engineering', bindingId: 'binding-1' })
    const caller = new AbortController()

    const invocation = host.invoke('connection-1', { operation: 'read' }, 60_000, caller.signal)
    await invokeEntered.promise

    expect(invokeSignal).toBeDefined()
    expect(invokeSignal).not.toBe(caller.signal)
    caller.abort()
    await expect(invocation).resolves.toEqual({ ok: true, data: null })
    expect(invokeSignal?.aborted).toBe(true)
  })

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

  it('preserves a replacement connection when a stale connect resolves non-ready', async () => {
    const firstStart = deferred<ConnectorStatus>()
    let starts = 0
    const { registry, host } = hostWith(
      connector('jira-engineering', async () => {
        starts += 1
        return starts === 1 ? firstStart.promise : { health: 'ready' }
      })
    )

    const staleConnect = host.connect({
      id: 'connection-1',
      connectorId: 'jira-engineering',
      bindingId: 'binding-a'
    })
    const staleConnection = registry.get('connection-1')
    expect(staleConnection).toBeDefined()
    registry.remove('connection-1')

    await host.connect({
      id: 'connection-1',
      connectorId: 'jira-engineering',
      bindingId: 'binding-b'
    })
    const replacement = registry.get('connection-1')
    expect(replacement?.bindingId).toBe('binding-b')
    expect(host.isStarted('connection-1')).toBe(true)

    firstStart.resolve({ health: 'unreachable' })
    await expect(staleConnect).resolves.toEqual({ health: 'unreachable' })

    expect(registry.get('connection-1')).toBe(replacement)
    expect(registry.get('connection-1')).not.toBe(staleConnection)
    expect(host.isStarted('connection-1')).toBe(true)
  })

  it('preserves a replacement connection when a stale connect start throws', async () => {
    const firstStart = deferred<ConnectorStatus>()
    let starts = 0
    const { registry, host } = hostWith(
      connector('jira-engineering', async () => {
        starts += 1
        return starts === 1 ? firstStart.promise : { health: 'ready' }
      })
    )

    const staleConnect = host.connect({
      id: 'connection-1',
      connectorId: 'jira-engineering',
      bindingId: 'binding-a'
    })
    registry.remove('connection-1')
    await host.connect({
      id: 'connection-1',
      connectorId: 'jira-engineering',
      bindingId: 'binding-b'
    })
    const replacement = registry.get('connection-1')

    firstStart.reject(new Error('offline'))
    await expect(staleConnect).resolves.toMatchObject({ health: 'error' })

    expect(registry.get('connection-1')).toBe(replacement)
    expect(host.isStarted('connection-1')).toBe(true)
  })

  it('does not mark a replacement connection started when an older start resolves ready', async () => {
    const firstStart = deferred<ConnectorStatus>()
    let starts = 0
    const { registry, host } = hostWith(
      connector('jira-engineering', async () => {
        starts += 1
        return starts === 1 ? firstStart.promise : { health: 'ready' }
      })
    )
    registry.create({ id: 'connection-1', connectorId: 'jira-engineering', bindingId: 'binding-a' })

    const staleStart = host.start('connection-1')
    registry.remove('connection-1')
    const replacement = registry.create({
      id: 'connection-1',
      connectorId: 'jira-engineering',
      bindingId: 'binding-b'
    })

    firstStart.resolve({ health: 'ready' })
    await expect(staleStart).resolves.toEqual({ health: 'ready' })

    expect(registry.get('connection-1')).toBe(replacement)
    expect(host.isStarted('connection-1')).toBe(false)
  })

  it('does not clear a replacement connection started state when an older stop completes', async () => {
    const firstStop = deferred<void>()
    let stops = 0
    const { registry, host } = hostWith(
      connector(
        'jira-engineering',
        async () => ({ health: 'ready' }),
        async () => {
          stops += 1
          return stops === 1 ? firstStop.promise : undefined
        }
      )
    )
    registry.create({ id: 'connection-1', connectorId: 'jira-engineering', bindingId: 'binding-a' })
    await host.start('connection-1')

    const staleStop = host.stop('connection-1')
    registry.remove('connection-1')
    const replacement = registry.create({
      id: 'connection-1',
      connectorId: 'jira-engineering',
      bindingId: 'binding-b'
    })
    await host.start('connection-1')

    firstStop.resolve()
    await staleStop

    expect(registry.get('connection-1')).toBe(replacement)
    expect(host.isStarted('connection-1')).toBe(true)
  })

  it('does not remove a replacement connection while a stale stopByBinding completes', async () => {
    const firstStop = deferred<void>()
    let stops = 0
    const { registry, host } = hostWith(
      connector(
        'jira-engineering',
        async () => ({ health: 'ready' }),
        async () => {
          stops += 1
          return stops === 1 ? firstStop.promise : undefined
        }
      )
    )
    registry.create({ id: 'connection-1', connectorId: 'jira-engineering', bindingId: 'binding-a' })
    await host.start('connection-1')

    const staleStop = host.stopByBinding('binding-a')
    registry.remove('connection-1')
    const replacement = registry.create({
      id: 'connection-1',
      connectorId: 'jira-engineering',
      bindingId: 'binding-a'
    })
    await host.start('connection-1')

    firstStop.resolve()
    await staleStop

    expect(registry.get('connection-1')).toBe(replacement)
    expect(host.isStarted('connection-1')).toBe(true)
  })
})
