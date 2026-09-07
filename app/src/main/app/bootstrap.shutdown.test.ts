import { readFileSync } from 'node:fs'
import { afterEach, describe, expect, it, vi, type Mock } from 'vitest'
import { stripCommentsAndStrings } from '../infra/source-scan'

vi.mock('electron', () => ({
  app: { getVersion: () => 'test' },
  BrowserWindow: { getAllWindows: () => [] },
  ipcMain: {},
  net: {},
  session: {},
  safeStorage: {}
}))
vi.mock('../infra/settings-store', () => ({ SettingsStore: class {} }))

import { Bootstrap } from './bootstrap'
import { ExtensionDeploymentService } from '../features/extensions/extension-deployment-service'
import * as extensionDeployer from '../features/extensions/deployer'
import type { OrcaMcpConfig } from '../adapters/mcp-config'
import type { RouterContext } from './context'
import { TypedBus } from '../infra/bus'
import type { MainBus, OrcaBusEvents } from '../contracts/bus-events'
import type { TurnContext } from '../contracts/turn'
import { HistoryWriter } from '../features/history/writer'
import { TitleGenerator } from '../features/chat/title-generation'
import type { NormalizedEvent } from '../../shared/ipc'

afterEach(() => vi.restoreAllMocks())

describe('Bootstrap turn event registration', () => {
  function setup(): {
    order: string[]
    recordTurnUsage: Mock<(turn: TurnContext) => void>
    bus: MainBus<Electron.WebContents>
    turn: TurnContext<Electron.WebContents>
    persistence: HistoryWriter
  } {
    const order: string[] = []
    const recordTurnUsage = vi.fn((turn: TurnContext) => {
      order.push(`usage:${turn.currentAssistantMessageId}`)
    })
    vi.spyOn(HistoryWriter.prototype, 'persist').mockImplementation((turn) => {
      order.push('history')
      turn.currentAssistantMessageId = null
    })
    vi.spyOn(TitleGenerator.prototype, 'maybeStart').mockImplementation(() => {
      order.push('title')
    })
    const ctx = { db: {}, cost: { recordTurnUsage } } as unknown as Pick<
      RouterContext,
      'db' | 'cost'
    >
    const bootstrap = Object.create(Bootstrap.prototype) as {
      registerTurnEvents(
        ctx: Pick<RouterContext, 'db' | 'cost'>,
        bus: MainBus<Electron.WebContents>
      ): HistoryWriter
    }
    const bus = new TypedBus<OrcaBusEvents<Electron.WebContents>>()
    const persistence = bootstrap.registerTurnEvents(ctx, bus)
    const turn = {
      currentAssistantMessageId: 42,
      owner: { isDestroyed: () => false, send: () => order.push('relay') }
    } as unknown as TurnContext<Electron.WebContents>
    return { order, recordTurnUsage, bus, turn, persistence }
  }

  it('records usage before history clears message identity, then starts title work before relay', () => {
    const { order, recordTurnUsage, bus, turn, persistence } = setup()
    const ev: NormalizedEvent = { type: 'telemetry', sessionId: 's' }
    bus.emit('turn.event', { turn, ev })
    expect(recordTurnUsage).toHaveBeenCalledExactlyOnceWith(turn, ev)
    expect(order).toEqual(['usage:42', 'history', 'title', 'relay'])
    expect(persistence).toBeInstanceOf(HistoryWriter)
  })

  it('does not record non-telemetry events and propagates recording failure before persistence', () => {
    const { order, recordTurnUsage, bus, turn } = setup()
    bus.emit('turn.event', { turn, ev: { type: 'session.updated', sessionId: 's', patch: {} } })
    expect(order).toEqual(['history', 'title', 'relay'])
    expect(recordTurnUsage).not.toHaveBeenCalled()
    order.length = 0
    const failure = new Error('usage write failed')
    recordTurnUsage.mockImplementation(() => {
      throw failure
    })
    expect(() =>
      bus.emit('turn.event', {
        turn,
        ev: { type: 'telemetry', sessionId: 's' }
      })
    ).toThrow(failure)
    expect(order).toEqual([])
  })
})

describe('Bootstrap title ownership', () => {
  it('disposes title work during shutdown even before turn runtime initialization completed', () => {
    const order: string[] = []
    const titles = { dispose: vi.fn(() => order.push('titles')) }
    // No constructor: the lifecycle entry runs with its actual prototype and owned fields.
    const bootstrap: Bootstrap = Object.assign(Object.create(Bootstrap.prototype), {
      titles,
      pendingMessages: {
        freeze: () => order.push('freeze'),
        disposeAll: () => order.push('queue')
      },
      activity: { dispose: () => order.push('activity') }
    })
    bootstrap.shutdown()
    expect(titles.dispose).toHaveBeenCalledOnce()
    expect(order).toEqual(['freeze', 'titles', 'queue', 'activity'])
  })

  it('retains the event subscriber title generator on the bootstrap owner', () => {
    const source = stripCommentsAndStrings(
      readFileSync(new URL('./bootstrap.ts', import.meta.url), 'utf8')
    )
    expect(source).toMatch(
      /const\s+titles\s*=\s*\(this\.titles\s*=\s*new\s+TitleGenerator\(ctx\.db\)\)/
    )
    expect(source).toMatch(/titles\.maybeStart\(turn\)/)
    expect(source).toMatch(/this\.registerTurnEvents\(ctx,\s*bus\)/)
  })
})

describe('Bootstrap deployment forwarding', () => {
  it('deploys enabled MCP servers after resolver expansion and excludes unresolved servers', async () => {
    const source: OrcaMcpConfig = {
      command: { command: 'fake-mcp', args: ['serve'], env: { TOKEN: '${TEST_TOKEN}' } },
      remote: {
        type: 'http',
        url: 'https://example.test/mcp',
        headers: { Authorization: 'Bearer ${TEST_TOKEN}' }
      },
      unresolved: { command: 'missing-mcp', env: { TOKEN: '${MISSING_TOKEN}' } }
    }
    const before = structuredClone(source)
    const enabledConfig = (): OrcaMcpConfig => source
    const resolver =
      (): ((name: string) => string | undefined) =>
      (name: string): string | undefined =>
        name === 'TEST_TOKEN' ? 'fake-expanded-token' : undefined
    const result: extensionDeployer.DeployResult = {
      engine: 'claude',
      dryRun: false,
      actions: [],
      backedUp: false,
      validation: { ok: true, errors: [] }
    }
    // Only the filesystem deployment boundary is replaced; Bootstrap, conversion and queue run.
    const deploy = vi.spyOn(extensionDeployer, 'deploy').mockResolvedValue(result)
    const bootstrap = Object.assign(Object.create(Bootstrap.prototype), {
      mcp: { enabledConfig, resolver }
    }) as { createDeploymentService(): ExtensionDeploymentService }

    await expect(bootstrap.createDeploymentService().deployNow()).resolves.toBe(result)

    expect(deploy).toHaveBeenCalledExactlyOnceWith('claude', {
      skillRoots: [
        expect.objectContaining({ sourceId: 'orca' }),
        expect.objectContaining({ sourceId: 'adapter:claude' })
      ],
      mcpConfig: {
        command: { command: 'fake-mcp', args: ['serve'], env: { TOKEN: 'fake-expanded-token' } },
        remote: {
          type: 'http',
          url: 'https://example.test/mcp',
          headers: { Authorization: 'Bearer fake-expanded-token' }
        }
      }
    })
    expect(source).toEqual(before)
  })

  it('keeps engine failure propagation while ordinary deployment remains tolerant', async () => {
    const failure = new Error('deployment failed')
    const deployment = new ExtensionDeploymentService({
      deploy: async () => {
        throw failure
      }
    })
    // Invoke the real private forwarding method without booting native application state.
    const bootstrap: Pick<RouterContext, 'deployExtensions'> = Object.assign(
      Object.create(Bootstrap.prototype),
      { deployment }
    )
    await expect(bootstrap.deployExtensions()).resolves.toBeUndefined()
    await expect(bootstrap.deployExtensions({ throwOnFailure: true })).rejects.toBe(failure)
  })
})
