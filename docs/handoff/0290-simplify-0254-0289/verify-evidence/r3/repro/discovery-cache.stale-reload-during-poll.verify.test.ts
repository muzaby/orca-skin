// 0290 r3 verify — repro C (verifier axis outside the r3 report).
// A reload reads `a` before the edit, then finishes while the poll pass that saw the edit is still
// reading. The reload's manifest therefore carries the old `a`. One edit must reach the holder once.
// Copied into app/src/main/adapters/opencode/v1/ only while running; not part of the app suite.
import { mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises'
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

it('notifies once when a reload that read the old content finishes during the poll pass', async () => {
  const cache = new OpenCodeDiscoveryCache()
  const a = join(root, 'opencode.json')
  const b = join(root, 'tui.json')
  await writeFile(a, 'a0')
  await writeFile(b, 'b0')
  const actual = await vi.importActual<typeof import('node:fs/promises')>('node:fs/promises')
  let pause: Promise<void> | undefined
  let afterA: (() => void) | undefined
  const load = async (): Promise<string[]> => {
    const first = await discoveryReadFile(a)
    afterA?.()
    if (pause) await pause
    return [first, await discoveryReadFile(b)]
  }
  const key = cache.key('configured', root, {})
  expect(await cache.run(key, load)).toEqual(['a0', 'b0'])
  const changed = vi.fn()
  releases.push(cache.hold(key, changed))

  // Reload: reads `a` (old content), then waits before reading `b`.
  now += 1001
  const gate = Promise.withResolvers<void>()
  const readA = Promise.withResolvers<void>()
  pause = gate.promise
  afterA = readA.resolve
  cache.invalidate()
  const reloading = cache.run(key, load)
  await readA.promise
  pause = undefined
  afterA = undefined

  // Edit after the reload read `a`; the poll pass blocks on its own fresh read of `a`.
  await writeFile(a, 'a1')
  now += 1001
  const entered = Promise.withResolvers<void>()
  const slow = Promise.withResolvers<string>()
  let blockNextA = true
  vi.mocked(readFile).mockImplementation(((path: string, encoding: BufferEncoding) => {
    if (path === a && blockNextA) {
      blockNextA = false
      entered.resolve()
      return slow.promise
    }
    return actual.readFile(path, encoding)
  }) as typeof readFile)
  const polling = cache.poll()
  await entered.promise
  // The reload finishes with the old `a` while the pass still waits.
  gate.resolve()
  expect(await reloading).toEqual(['a0', 'b0'])
  slow.resolve('a1')
  await polling

  expect(changed).toHaveBeenCalledOnce()
  await cache.poll()
  expect(changed).toHaveBeenCalledOnce()
  expect(await cache.run(key, load)).toEqual(['a1', 'b0'])
})
