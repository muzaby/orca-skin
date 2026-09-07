import { readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'
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
import type { RouterContext } from './context'

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
  })
})

describe('Bootstrap deployment forwarding', () => {
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
