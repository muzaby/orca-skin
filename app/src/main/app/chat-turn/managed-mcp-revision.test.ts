import { expect, it, vi } from 'vitest'
import { ExtensionBuilder } from '../../features/extensions/common/builder'
import { createManagedMcpSource } from '../../features/extensions/common/mcp/managed-source'
import { SessionRuntime } from '../../features/sessions/session-runtime'
import { acquireTurnRuntime } from './runtime-entry'
import { prepareAutomaticContinuation } from '../chat-turn-continuation'
import { decideRespawn } from '../../features/sessions/respawn-policy'
import { respawnInputs } from './respawn-inputs'
import type { DbQueries } from '../../infra/db'
import type { Settings } from '../../../shared/ipc'
import type { RuntimeSessionAdapter } from '../../contracts/ports'
import type { OrcaMcpConfig } from '../../adapters/common/mcp-config'
import type { ManagedMcpSnapshot, ManagedMcpSource } from '../../adapters/common/managed-mcp'
import { OpenCodeAdapter } from '../../adapters/opencode/v1/adapter'

it.each(['opencode', 'claude'] as const)(
  'uses the %s restart policy through both turn entries and resets its recorded revision',
  async (backend) => {
    let snapshot: ManagedMcpSnapshot = {
      revision: 37,
      definitionRevision: 11,
      connectionRevision: 23,
      users: { distinct: { command: 'tool' } },
      plugins: new Map()
    }
    const source: ManagedMcpSource = {
      snapshot: () => snapshot,
      refresh: () => {},
      subscribe: () => () => {}
    }
    const builder = new ExtensionBuilder(
      {} as DbQueries,
      () => [],
      () => ({ language: 'ko', accountInstructions: '' }) as Settings,
      'test',
      undefined,
      undefined,
      source
    )
    const build = (): ReturnType<ExtensionBuilder['build']> => builder.build(null, null)
    const spawned: ManagedMcpSnapshot[] = []
    const closed: (() => void)[] = []
    const adapter: RuntimeSessionAdapter = {
      id: backend,
      complete: async () => '',
      classifyError: vi.fn(),
      ...(backend === 'opencode'
        ? { restartRevision: OpenCodeAdapter.prototype.restartRevision }
        : {}),
      sendMessage(request) {
        spawned.push(request.extensions.managedMcp!)
        const end = Promise.withResolvers<void>()
        closed.push(end.resolve)
        return {
          eventBatches: (async function* () {
            yield {
              sequence: 1,
              events: [{ type: 'telemetry' as const, sessionId: 'policy-session' }]
            }
            await end.promise
          })(),
          close: end.resolve,
          pushTurn: async () => ({ kind: 'accepted' }),
          interrupt: async () => undefined,
          setModel: async () => {},
          setPermissionMode: async () => {},
          stopTask: async () => {},
          backgroundTask: async () => false
        }
      }
    }
    const runtime = new SessionRuntime(adapter)
    const deps = {
      adapter,
      buildExtensions: build,
      supervisor: { acquireRuntime: () => runtime, activateChain: () => true },
      lease: { leaseId: 'distinct-lease', controller: new AbortController() },
      settleDeadBackgroundTasks: vi.fn(async () => {})
    } as unknown as Parameters<typeof acquireTurnRuntime>[0]
    const prepared = { envFingerprint: '', runtimeEnvFingerprint: undefined }
    const input = {
      sessionId: 'policy-session',
      resolved: { providerKey: null, prepared },
      sessionProviderKey: null
    }
    const turn = { extraDirs: [] } as unknown as Parameters<typeof acquireTurnRuntime>[1]
    const start = async (): Promise<void> => {
      for await (const event of runtime.send({
        sessionId: 'policy-session',
        cwd: 'C:/policy',
        text: 'hello',
        extensions: build()
      }))
        expect(event.type).toBe('telemetry')
    }
    const continuation = (): ReturnType<typeof prepareAutomaticContinuation> =>
      prepareAutomaticContinuation({
        runtime,
        providerKey: null,
        modelFamily: null,
        fallbackModel: undefined,
        resolveProvider: async () => ({ providerKey: null, prepared }),
        buildExtensions: build
      })
    try {
      await start()
      expect(spawned[0]).toMatchObject({
        revision: 37,
        definitionRevision: 11,
        connectionRevision: 23
      })
      expect(runtime.spawnedManagedMcpRevision).toBe(backend === 'opencode' ? 11 : 37)
      expect((await continuation()).shouldRespawn).toBe(false)
      expect((await acquireTurnRuntime(deps, turn, input)).ok).toBe(true)
      expect(runtime.channelAlive).toBe(true)
      snapshot = { ...snapshot, revision: 38, connectionRevision: 24, users: {} }
      expect((await continuation()).shouldRespawn).toBe(backend === 'claude')
      expect((await acquireTurnRuntime(deps, turn, input)).ok).toBe(true)
      expect(runtime.channelAlive).toBe(backend === 'opencode')
      if (backend === 'claude') await start()
      expect(spawned.length).toBe(backend === 'opencode' ? 1 : 2)
      snapshot = { ...snapshot, revision: 39, definitionRevision: 12 }
      expect((await continuation()).shouldRespawn).toBe(true)
      await acquireTurnRuntime(deps, turn, input)
      expect(runtime.channelAlive).toBe(false)
      expect(runtime.spawnedManagedMcpRevision).toBeUndefined()
      await start()
      expect(runtime.spawnedManagedMcpRevision).toBe(backend === 'opencode' ? 12 : 39)
      expect(
        decideRespawn(
          respawnInputs({
            runtime,
            prepared: { ...prepared, runtimeEnvFingerprint: 'changed-env' },
            previousProviderKey: null,
            nextProviderKey: null,
            model: undefined,
            runtimeToolsRevision: undefined,
            managedMcpRevision: runtime.managedMcpRevision(snapshot),
            executionCwdRecovered: false
          })
        )
      ).toBe(true)
      expect(runtime.managedMcpRevision(undefined)).toBeUndefined()
    } finally {
      runtime.close()
      closed.forEach((close) => close())
    }
    expect(runtime.spawnedManagedMcpRevision).toBeUndefined()
  }
)

it('applies new revisions to user and continuation turns', async () => {
  let changed = false
  const source = createManagedMcpSource({
    users: (): OrcaMcpConfig => (changed ? { next: { command: 'next' } } : {}),
    resolver: () => () => undefined,
    plugins: () => []
  })
  source.refresh()
  const builder = new ExtensionBuilder(
    {} as DbQueries,
    () => [],
    () => ({ language: 'ko', accountInstructions: '' }) as Settings,
    'test',
    undefined,
    undefined,
    source
  )
  const build = (): ReturnType<ExtensionBuilder['build']> => builder.build(null, null)
  const requests: number[] = []
  const closers: Array<() => void> = []
  const adapter: RuntimeSessionAdapter = {
    id: 'opencode',
    complete: async () => '',
    classifyError: vi.fn(),
    sendMessage: (request) => {
      requests.push(request.extensions.managedMcp!.revision)
      let finish!: () => void
      const ended = new Promise<void>((resolve) => {
        finish = resolve
      })
      closers.push(finish)
      return {
        eventBatches: (async function* () {
          yield { sequence: 1, events: [{ type: 'telemetry' as const, sessionId: 'session' }] }
          await ended
        })(),
        close: finish,
        pushTurn: async () => ({ kind: 'accepted' }),
        interrupt: async () => undefined,
        setModel: async () => {},
        setPermissionMode: async () => {},
        stopTask: async () => {},
        backgroundTask: async () => false
      }
    }
  }
  const runtime = new SessionRuntime(adapter)
  const turn = { extraDirs: [] } as unknown as Parameters<typeof acquireTurnRuntime>[1]
  const deps = {
    adapter,
    buildExtensions: build,
    supervisor: { acquireRuntime: () => runtime, activateChain: () => true },
    lease: { leaseId: 'lease', controller: new AbortController() },
    settleDeadBackgroundTasks: vi.fn(async () => {})
  } as unknown as Parameters<typeof acquireTurnRuntime>[0]
  const prepared = { runtimeEnvFingerprint: undefined, envFingerprint: '' }
  const input = {
    sessionId: 'session',
    resolved: { providerKey: null, prepared },
    sessionProviderKey: null
  }
  const start = async (): Promise<void> => {
    for await (const event of runtime.send({
      sessionId: 'session',
      cwd: 'C:/work',
      text: 'hello',
      extensions: build()
    })) {
      expect(event.type).toBe('telemetry')
    }
  }
  try {
    await start()
    expect(runtime.channelAlive).toBe(true)
    expect(runtime.spawnedManagedMcpRevision).toBe(1)
    expect((await acquireTurnRuntime(deps, turn, input)).ok).toBe(true)
    expect(runtime.channelAlive).toBe(true)
    changed = true
    source.refresh()
    const user = await acquireTurnRuntime(deps, turn, input)
    expect(user).toMatchObject({ ok: true, extensions: { managedMcp: { revision: 2 } } })
    expect(runtime.channelAlive).toBe(false)
    expect(runtime.spawnedManagedMcpRevision).toBeUndefined()
    await start()
    expect(requests).toEqual([1, 2])
    expect(runtime.spawnedManagedMcpRevision).toBe(2)
    const continuation = (revision?: number): ReturnType<typeof prepareAutomaticContinuation> =>
      prepareAutomaticContinuation({
        runtime,
        providerKey: null,
        modelFamily: null,
        fallbackModel: undefined,
        resolveProvider: async () => ({ providerKey: null, prepared }),
        buildExtensions: () => ({
          ...build(),
          ...(revision === undefined
            ? { managedMcp: undefined }
            : { managedMcp: { revision, users: {}, plugins: new Map() } })
        })
      })
    expect((await continuation(2)).shouldRespawn).toBe(false)
    expect((await continuation(3)).shouldRespawn).toBe(true)
    expect((await continuation(0)).shouldRespawn).toBe(true)
    expect((await continuation()).shouldRespawn).toBe(true)
    expect(
      decideRespawn(
        respawnInputs({
          runtime: {
            ...runtime,
            channelAlive: true,
            spawnedModel: undefined,
            spawnedProviderSettings: undefined,
            spawnedRuntimeEnvFingerprint: undefined,
            spawnedRuntimeToolsRevision: undefined,
            spawnedManagedMcpRevision: 0
          },
          prepared,
          previousProviderKey: null,
          nextProviderKey: null,
          model: undefined,
          runtimeToolsRevision: undefined,
          managedMcpRevision: 0,
          executionCwdRecovered: false
        })
      )
    ).toBe(false)
  } finally {
    runtime.close()
    closers.forEach((close) => close())
  }
})
