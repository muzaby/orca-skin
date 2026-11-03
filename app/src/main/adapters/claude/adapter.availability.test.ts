import { afterEach, expect, it, vi } from 'vitest'
const fixture = vi.hoisted(() => ({ fail: false }))
vi.mock('node:module', async (original) => {
  const actual = await original<typeof import('node:module')>()
  return {
    ...actual,
    createRequire: (filename: string | URL) =>
      new Proxy(actual.createRequire(filename), {
        apply(target, thisArg, args: unknown[]) {
          if (args[0] === '@anthropic-ai/claude-agent-sdk/package.json') {
            if (fixture.fail) throw new Error('package metadata unavailable')
            return { version: 'sdk-sentinel' }
          }
          return Reflect.apply(target, thisArg, args)
        }
      })
  }
})
import { ClaudeAdapter } from './adapter'
import { AdapterRegistry } from '../common/registry'
afterEach(() => {
  fixture.fail = false
})
it.each([false, true])(
  'keeps the bundled Claude adapter usable when package metadata fails: %s',
  async (fail) => {
    fixture.fail = fail
    const adapter = new ClaudeAdapter()
    expect(await adapter.isInstalled()).toEqual({
      installed: !fail,
      usable: true,
      ...(!fail ? { version: 'sdk-sentinel' } : {})
    })
    const registry = new AdapterRegistry([adapter], null)
    try {
      await registry.refreshInstallState()
      expect(registry.availability('claude')).toEqual({
        id: 'claude',
        installed: !fail,
        usable: true,
        ...(!fail ? { version: 'sdk-sentinel' } : {})
      })
    } finally {
      registry.close()
    }
  }
)
