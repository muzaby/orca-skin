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
  root = await realpath(await mkdtemp(join(tmpdir(), 'orca-discovery-poll-')))
  now = Date.now()
  vi.spyOn(Date, 'now').mockImplementation(() => now)
  // Drive poll explicitly: filesystem timing cannot start a competing watcher pass.
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

it('notifies an edit made after the content read but before dependency registration', async () => {
  const cache = new OpenCodeDiscoveryCache()
  const file = join(root, 'opencode.json')
  await writeFile(file, 'original')
  const actual = await vi.importActual<typeof import('node:fs/promises')>('node:fs/promises')
  vi.mocked(readFile).mockImplementationOnce(async () => {
    const value = await actual.readFile(file, 'utf8')
    await writeFile(file, 'edited after reading')
    return value
  })
  const key = cache.key('configured', root, {})
  expect(await cache.run(key, () => discoveryReadFile(file))).toBe('original')
  const changed = vi.fn()
  releases.push(cache.hold(key, changed))
  await cache.poll()
  expect(changed).toHaveBeenCalledOnce()
  expect(await cache.run(key, () => discoveryReadFile(file))).toBe('edited after reading')
  await cache.poll()
  expect(changed).toHaveBeenCalledOnce()
})

it.each(['same-value', 'newer-value', 'new-file'] as const)(
  'notifies an overlapping reload once and keeps its latest dependencies: %s',
  async (reload) => {
    const cache = new OpenCodeDiscoveryCache()
    const file = join(root, 'opencode.json')
    const latestFile = reload === 'new-file' ? join(root, 'alternate.json') : file
    const latestValue = reload === 'same-value' ? 'polled change' : 'newest reload value'
    const key = cache.key('configured', root, {})
    await writeFile(file, 'original')
    await cache.run(key, () => discoveryReadFile(file))
    const changed = vi.fn()
    releases.push(cache.hold(key, changed))
    await writeFile(file, 'polled change')
    now += 1001
    const entered = Promise.withResolvers<void>()
    const slow = Promise.withResolvers<string>()
    vi.mocked(readFile).mockImplementationOnce(() => {
      entered.resolve()
      return slow.promise
    })
    const polling = cache.poll()
    try {
      await entered.promise
      await writeFile(latestFile, latestValue)
      cache.invalidate()
      expect(await cache.run(key, () => discoveryReadFile(latestFile))).toBe(latestValue)
    } finally {
      slow.resolve('polled change')
      await polling
    }
    expect(changed).toHaveBeenCalledOnce()
    // The old poll must not publish its manifest over the reload's newer one.
    await cache.poll()
    expect(changed).toHaveBeenCalledOnce()
    if (reload === 'new-file') {
      await writeFile(file, 'no longer a dependency')
      now += 1001
      await cache.poll()
      expect(changed).toHaveBeenCalledOnce()
    }
    await writeFile(latestFile, 'next edit of the current dependency')
    now += 1001
    await cache.poll()
    expect(changed).toHaveBeenCalledTimes(2)
    await cache.poll()
    expect(changed).toHaveBeenCalledTimes(2)
    expect(await cache.run(key, () => discoveryReadFile(latestFile))).toBe(
      'next edit of the current dependency'
    )
  }
)
