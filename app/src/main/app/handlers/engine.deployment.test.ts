import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CHANNELS } from '../../../shared/protocol'
import { ExtensionDeploymentService } from '../../features/extensions/extension-deployment-service'
import type { DeployResult } from '../../features/extensions/deployer'

const { callbacks, directDeploy } = vi.hoisted(() => ({
  callbacks: new Map<string, (request: unknown) => unknown>(),
  directDeploy: vi.fn(async () => ({ validation: { ok: true, errors: [] } }))
}))
vi.mock('../../infra/ipc/handle', () => ({
  handle: (
    channel: string,
    _schema: unknown,
    _mode: unknown,
    callback: (req: unknown) => unknown
  ) => callbacks.set(channel, callback),
  handlePlain: (channel: string, callback: (req: unknown) => unknown) =>
    callbacks.set(channel, callback)
}))
vi.mock('../../features/extensions/deployer', () => ({ deploy: directDeploy }))
vi.mock('../../features/harnesses/settings-write', () => ({
  addHarnessSettings: vi.fn(() => ({})),
  updateHarnessSettings: vi.fn(() => ({})),
  deleteHarnessSettings: vi.fn(),
  readHarnessSettings: vi.fn(() => ({}))
}))
vi.mock('../../adapters/claude-settings', () => ({ readUserClaudeSettings: vi.fn() }))
vi.mock('../../infra/log', () => ({ getLogger: () => ({ child: () => ({ warn: vi.fn() }) }) }))
vi.mock('../../infra/log/registry', () => ({
  getLogger: () => ({ child: () => ({ warn: vi.fn() }) })
}))

import { registerEngineHandlers } from './engine'
import { registerMcpHandlers } from './mcp'

const edits = [
  [CHANNELS.engineAdd, { engine: 'claude', provider: 'corp', settingsJson: '{}' }],
  [CHANNELS.engineUpdate, { key: 'claude-corp', settingsJson: '{}' }],
  [CHANNELS.engineDelete, { key: 'claude-corp' }]
] as const

function result(): DeployResult {
  return {
    engine: 'claude',
    dryRun: false,
    actions: [],
    backedUp: false,
    validation: { ok: true, errors: [] }
  }
}

function registerEngine(
  deployExtensions: (options?: { throwOnFailure?: boolean }) => Promise<void>,
  order: string[]
): void {
  registerEngineHandlers({
    deployExtensions,
    harnessSettings: {
      invalidateAll: () => {
        order.push('settings')
      }
    },
    harnessRuntime: {
      invalidate: (key, reason) => {
        order.push(`runtime:${key}:${reason}`)
      }
    },
    runtimeModelCatalog: {
      isReadOnly: () => false,
      invalidate: async (key) => {
        order.push(`catalog:${key}`)
      }
    }
  })
}

function invoke(channel: string, request: unknown): Promise<unknown> {
  const callback = callbacks.get(channel)
  if (!callback) throw new Error(`Missing callback: ${channel}`)
  return Promise.resolve(callback(request))
}

describe('engine CRUD uses the shared extension deployment queue', () => {
  beforeEach(() => {
    callbacks.clear()
    directDeploy.mockClear()
  })

  it('preserves the existing behavior without optional runtime services', async () => {
    const deployExtensions = vi.fn(async () => {})
    const invalidateAll = vi.fn()
    registerEngineHandlers({ deployExtensions, harnessSettings: { invalidateAll } })
    await invoke(CHANNELS.engineDelete, { key: 'claude-corp' })
    expect(deployExtensions).toHaveBeenCalledOnce()
    expect(invalidateAll).toHaveBeenCalledOnce()
  })

  it.each(edits)(
    '%s waits for MCP deployment and the coalesced latest deployment',
    async (channel, request) => {
      const order: string[] = []
      let release!: () => void
      const held = new Promise<void>((resolve) => {
        release = resolve
      })
      let runs = 0
      let active = 0
      let maxActive = 0
      const service = new ExtensionDeploymentService({
        deploy: async () => {
          const run = ++runs
          maxActive = Math.max(maxActive, ++active)
          order.push(`deploy:${run}`)
          if (run === 1) await held
          active -= 1
          return result()
        }
      })
      const deployExtensions = async (options?: { throwOnFailure?: boolean }): Promise<void> => {
        await service.deployNow(options)
      }
      registerEngine(deployExtensions, order)
      registerMcpHandlers({
        deployExtensions,
        mcp: { list: () => [], add: vi.fn(), update: vi.fn(), remove: vi.fn() }
      })
      const mcp = invoke(CHANNELS.mcpDelete, { id: 'server' })
      const engine = invoke(channel, request)
      release()
      await Promise.all([mcp, engine])
      expect(order).toEqual([
        'deploy:1',
        'deploy:2',
        'settings',
        'runtime:claude-corp:harness-settings-crud',
        'catalog:claude-corp'
      ])
      expect(maxActive).toBe(1)
      expect(directDeploy).not.toHaveBeenCalled()
    }
  )

  it.each(edits)(
    '%s propagates the original service failure after invalidating all caches',
    async (channel, request) => {
      const order: string[] = []
      const failure = new Error('fixture deployment failure')
      const service = new ExtensionDeploymentService({
        deploy: async () => {
          order.push('deploy:failed')
          throw failure
        }
      })
      registerEngine(async (options) => {
        await service.deployNow(options)
      }, order)
      await expect(invoke(channel, request)).rejects.toBe(failure)
      expect(order).toEqual([
        'deploy:failed',
        'settings',
        'runtime:claude-corp:harness-settings-crud',
        'catalog:claude-corp'
      ])
      expect(directDeploy).not.toHaveBeenCalled()
    }
  )

  it('keeps finally invalidation when the injected deployment rejects', async () => {
    const order: string[] = []
    const failure = new Error('deployment rejected')
    registerEngine(async () => {
      throw failure
    }, order)
    await expect(invoke(CHANNELS.engineDelete, { key: 'claude-corp' })).rejects.toBe(failure)
    expect(order).toEqual([
      'settings',
      'runtime:claude-corp:harness-settings-crud',
      'catalog:claude-corp'
    ])
  })
})
