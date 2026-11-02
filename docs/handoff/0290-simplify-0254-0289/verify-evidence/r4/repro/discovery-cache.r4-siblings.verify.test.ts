// 0290 r4 verify — sibling orders outside the r4 report's six-order list (verifier axes).
// Copied into app/src/main/adapters/opencode/v1/ only while running; not part of the app suite.
import { mkdtemp, readFile, realpath, rm, utimes, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { discoveryReadFile, openCodeDiscovery, OpenCodeDiscoveryCache } from './discovery-cache'

vi.mock('node:fs', async (original) => ({
  ...(await original<typeof import('node:fs')>()),
  watchFile: vi.fn(),
  unwatchFile: vi.fn()
}))
vi.mock('node:fs/promises', async (original) => {
  const fs = await original<typeof import('node:fs/promises')>()
  return { ...fs, readFile: vi.fn(fs.readFile) }
})

let root: string, now: number
const releases: (() => void)[] = []
beforeEach(async () => {
  root = await realpath(await mkdtemp(join(tmpdir(), 'orca-discovery-stale-')))
  now = Date.now()
  vi.spyOn(Date, 'now').mockImplementation(() => now)
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
  vi.mocked(readFile).mockClear()
})
afterEach(async () => {
  for (const release of releases.splice(0)) release()
  openCodeDiscovery.invalidate()
  vi.useRealTimers()
  vi.restoreAllMocks()
  await rm(root, { recursive: true, force: true })
})


type Fs = typeof import('node:fs/promises')
async function setup(cache: OpenCodeDiscoveryCache) {
  const a = join(root, 'opencode.json')
  const b = join(root, 'tui.json')
  await writeFile(a, 'a0')
  await writeFile(b, 'b0')
  const actual = await vi.importActual<Fs>('node:fs/promises')
  const state: { pause?: Promise<void>; afterA?: () => void } = {}
  const load = async (): Promise<string[]> => {
    const first = await discoveryReadFile(a)
    state.afterA?.()
    if (state.pause) await state.pause
    return [first, await discoveryReadFile(b)]
  }
  const key = cache.key('configured', root, {})
  expect(await cache.run(key, load)).toEqual(['a0', 'b0'])
  const changed = vi.fn()
  releases.push(cache.hold(key, changed))
  // Reload: reads `a`, then waits before reading `b`.
  const startReload = async () => {
    const gate = Promise.withResolvers<void>()
    const readA = Promise.withResolvers<void>()
    state.pause = gate.promise
    state.afterA = readA.resolve
    cache.invalidate()
    const reloading = cache.run(key, load)
    await readA.promise
    state.pause = undefined
    state.afterA = undefined
    return { finish: async () => { gate.resolve(); return reloading } }
  }
  // Poll pass whose fresh read of `path` blocks until released.
  const blockedPass = async (path: string) => {
    const entered = Promise.withResolvers<void>()
    const slow = Promise.withResolvers<string>()
    let block = true
    vi.mocked(readFile).mockImplementation(((p: string, encoding: BufferEncoding) => {
      if (p === path && block) {
        block = false
        entered.resolve()
        return slow.promise
      }
      return actual.readFile(p, encoding)
    }) as typeof readFile)
    const polling = cache.poll()
    await entered.promise
    return { release: async (value: string) => { slow.resolve(value); await polling } }
  }
  return { a, b, load, key, changed, startReload, blockedPass }
}

// Sibling E — the D8 order followed by a second edit: two edits must reach the holder twice.
it('E: a stale reload during the pass, then a second edit, notifies once per edit', async () => {
  const cache = new OpenCodeDiscoveryCache()
  const t = await setup(cache)
  now += 1001
  const reload = await t.startReload()
  await writeFile(t.a, 'a1')
  now += 1001
  const pass = await t.blockedPass(t.a)
  expect(await reload.finish()).toEqual(['a0', 'b0'])
  await pass.release('a1')
  expect(t.changed).toHaveBeenCalledTimes(1)
  await writeFile(t.a, 'a2')
  now += 1001
  await cache.poll()
  expect(t.changed).toHaveBeenCalledTimes(2)
  await cache.poll()
  expect(t.changed).toHaveBeenCalledTimes(2)
  expect(await cache.run(t.key, t.load)).toEqual(['a2', 'b0'])
})

// Sibling G — the edit lands on the file the reload reads after its pause (`b`), while the pass
// blocks on the unchanged `a`. The reload finishes during the pass with the new `b`.
it('G: an edit to the file a paused reload reads later notifies once', async () => {
  const cache = new OpenCodeDiscoveryCache()
  const t = await setup(cache)
  now += 1001
  const reload = await t.startReload()
  await writeFile(t.b, 'b1')
  now += 1001
  const pass = await t.blockedPass(t.a)
  expect(await reload.finish()).toEqual(['a0', 'b1'])
  await pass.release('a0')
  expect(t.changed).toHaveBeenCalledTimes(1)
  await cache.poll()
  expect(t.changed).toHaveBeenCalledTimes(1)
  expect(await cache.run(t.key, t.load)).toEqual(['a0', 'b1'])
})

// Sibling H — two holders on different keys share the edited file; only one key reloads (stale)
// during the pass. Each holder must hear the one edit once.
it('H: a stale reload on one of two keys sharing the file notifies each holder once', async () => {
  const cache = new OpenCodeDiscoveryCache()
  const t = await setup(cache)
  const other = cache.key('configured', root, {}, 'other')
  const otherLoad = async () => [await discoveryReadFile(t.a)]
  expect(await cache.run(other, otherLoad)).toEqual(['a0'])
  const otherChanged = vi.fn()
  releases.push(cache.hold(other, otherChanged))
  now += 1001
  const reload = await t.startReload()
  await writeFile(t.a, 'a1')
  now += 1001
  const pass = await t.blockedPass(t.a)
  expect(await reload.finish()).toEqual(['a0', 'b0'])
  await pass.release('a1')
  await cache.poll()
  expect(t.changed).toHaveBeenCalledTimes(1)
  expect(otherChanged).toHaveBeenCalledTimes(1)
  expect(await cache.run(t.key, t.load)).toEqual(['a1', 'b0'])
  expect(await cache.run(other, otherLoad)).toEqual(['a1'])
})

// Sibling I — the D8 order after a touch that changed `a`'s stat but not its content. The reload reads
// the same content as the pass's baseline under a different fingerprint; one edit must still reach
// the holder once (adoption is by content signature).
it('I: a touch before the stale reload does not turn one edit into two notifications', async () => {
  const cache = new OpenCodeDiscoveryCache()
  const t = await setup(cache)
  const later = new Date(Date.now() + 5000)
  await utimes(t.a, later, later)
  now += 1001
  const reload = await t.startReload()
  await writeFile(t.a, 'a1')
  now += 1001
  const pass = await t.blockedPass(t.a)
  expect(await reload.finish()).toEqual(['a0', 'b0'])
  await pass.release('a1')
  expect(t.changed).toHaveBeenCalledTimes(1)
  await cache.poll()
  expect(t.changed).toHaveBeenCalledTimes(1)
  expect(await cache.run(t.key, t.load)).toEqual(['a1', 'b0'])
})

// Sibling J — after the D8 adoption a second consumer holds the same key (re-arming the watcher from
// the observer manifest). Neither holder hears anything until the next real edit, then each once.
it('J: a second hold after the adoption re-arms without a spurious notification', async () => {
  const cache = new OpenCodeDiscoveryCache()
  const t = await setup(cache)
  now += 1001
  const reload = await t.startReload()
  await writeFile(t.a, 'a1')
  now += 1001
  const pass = await t.blockedPass(t.a)
  await reload.finish()
  await pass.release('a1')
  const second = vi.fn()
  releases.push(cache.hold(t.key, second))
  await vi.advanceTimersByTimeAsync(500)
  await cache.poll()
  expect([t.changed.mock.calls.length, second.mock.calls.length]).toEqual([1, 0])
  await writeFile(t.a, 'a2')
  now += 1001
  await cache.poll()
  expect([t.changed.mock.calls.length, second.mock.calls.length]).toEqual([2, 1])
})
