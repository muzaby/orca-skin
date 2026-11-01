import { mkdtemp, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, expect, it, vi } from 'vitest'
import { discoveryReadFile, openCodeDiscovery, OpenCodeDiscoveryCache } from './discovery-cache'

let root: string
const releases: (() => void)[] = []
afterEach(async () => {
  for (const release of releases.splice(0)) release()
  openCodeDiscovery.invalidate()
  await rm(root, { recursive: true, force: true })
})

it.each(['before-hold', 'during-load'] as const)(
  'notifies once about a dependency changed %s without a later edit',
  async (timing) => {
    root = await realpath(await mkdtemp(join(tmpdir(), 'orca-verify-')))
    const cache = new OpenCodeDiscoveryCache()
    const file = join(root, 'opencode.json')
    await writeFile(file, '{"mcp":{}}')
    const key = cache.key('configured', root, {})
    const loaded = Promise.withResolvers<void>()
    const resume = Promise.withResolvers<void>()
    const reading = cache.run(key, async () => {
      const value = await discoveryReadFile(file)
      loaded.resolve()
      await resume.promise
      return value
    })
    await loaded.promise
    if (timing === 'before-hold') {
      resume.resolve()
      expect(await reading).toBe('{"mcp":{}}')
    }
    await new Promise((done) => setTimeout(done, 20))
    // e.g. the user edits opencode.json while the OpenCode server is still starting
    await writeFile(file, '{"mcp":{"added":{"enabled":true}}}')
    resume.resolve()
    await reading
    const changed = vi.fn()
    releases.push(cache.hold(key, changed))
    await vi.waitFor(() => expect(changed).toHaveBeenCalledOnce(), { timeout: 4000, interval: 100 })
  },
  10000
)

it('control: notifies a holder about a dependency change made after hold', async () => {
  root = await realpath(await mkdtemp(join(tmpdir(), 'orca-verify-')))
  const cache = new OpenCodeDiscoveryCache()
  const file = join(root, 'opencode.json')
  await writeFile(file, '{"mcp":{}}')
  const key = cache.key('configured', root, {})
  await cache.run(key, () => discoveryReadFile(file))
  const changed = vi.fn()
  releases.push(cache.hold(key, changed))
  await new Promise((done) => setTimeout(done, 50))
  await writeFile(file, '{"mcp":{"added":{"enabled":true}}}')
  await vi.waitFor(() => expect(changed).toHaveBeenCalledOnce(), { timeout: 4000, interval: 100 })
}, 10000)
