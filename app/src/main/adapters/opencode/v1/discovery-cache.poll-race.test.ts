import { mkdtemp, readFile, realpath, rm, utimes, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { watchFile } from 'node:fs'
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
  root = await realpath(await mkdtemp(join(tmpdir(), 'orcinus-orca-discovery-poll-')))
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

// Every relative order of a reload (reads `a` before/after the edit, finishes before/during/after the
// poll pass that sees the edit). Expected counts are what the pre-0290 discovery code produced for the
// same test: one edit reaches the holder once, except a reload that already read the edit before any
// pass, whose manifest has no change left to report. A touch changes the reload's fingerprint without
// changing its content: adoption must compare content signatures, not stat fingerprints (0290 D10).
it.each(
  (
    [
      ['before-edit', 'before-pass', 1],
      ['before-edit', 'during-pass', 1],
      ['before-edit', 'after-pass', 1],
      ['after-edit', 'before-pass', 0],
      ['after-edit', 'during-pass', 1],
      ['after-edit', 'after-pass', 1]
    ] as const
  ).flatMap(([reads, finishes, expected]) =>
    [false, true].map((touch) => ({ reads, finishes, expected, touch }))
  )
)(
  'reports one edit once when a reload reads it $reads and finishes $finishes (touch: $touch)',
  async ({ reads, finishes, expected, touch }) => {
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
    await cache.run(key, load)
    const changed = vi.fn()
    releases.push(cache.hold(key, changed))
    if (touch) {
      const later = new Date(now + 5000)
      await utimes(a, later, later)
    }
    const gate = Promise.withResolvers<void>()
    let reloading: Promise<string[]> | undefined
    const startReload = async (): Promise<void> => {
      const readA = Promise.withResolvers<void>()
      pause = gate.promise
      afterA = readA.resolve
      cache.invalidate()
      reloading = cache.run(key, load)
      await readA.promise
      pause = undefined
      afterA = undefined
    }
    const finishReload = async (): Promise<void> => {
      gate.resolve()
      await reloading
    }
    now += 1001
    if (reads === 'before-edit') await startReload()
    await writeFile(a, 'a1')
    now += 1001
    if (finishes === 'during-pass') {
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
      if (reads === 'after-edit') await startReload()
      await finishReload()
      slow.resolve('a1')
      await polling
    } else {
      if (reads === 'after-edit') await startReload()
      if (finishes === 'before-pass') await finishReload()
      await cache.poll()
      if (finishes === 'after-pass') await finishReload()
    }
    expect(changed).toHaveBeenCalledTimes(expected)
    await cache.poll()
    expect(changed).toHaveBeenCalledTimes(expected)
    expect(await cache.run(key, load)).toEqual(['a1', 'b0'])
    await writeFile(a, 'a2')
    now += 1001
    await cache.poll()
    expect(changed).toHaveBeenCalledTimes(expected + 1)
    await cache.poll()
    expect(changed).toHaveBeenCalledTimes(expected + 1)
    expect(await cache.run(key, load)).toEqual(['a2', 'b0'])
  }
)

it('re-watches the dependency file a reload switched to and reports its edit through the watcher', async () => {
  const cache = new OpenCodeDiscoveryCache()
  const first = join(root, 'opencode.json')
  const second = join(root, 'instructions.md')
  await writeFile(first, 'first')
  await writeFile(second, 'second')
  let target = first
  const key = cache.key('configured', root, {})
  const load = async (): Promise<string> => {
    await discoveryReadFile(first)
    return discoveryReadFile(target)
  }
  await cache.run(key, load)
  const changed = vi.fn()
  releases.push(cache.hold(key, changed))
  target = second
  cache.invalidate()
  expect(await cache.run(key, load)).toBe('second')
  // The production trigger is the stat watcher on the current dependency file, not a direct poll.
  // watchFile(file, options, listener) — the overload the watcher uses.
  const call = (vi.mocked(watchFile).mock.calls as unknown as unknown[][]).findLast(
    ([file]) => file === second
  )
  const listener = call?.[2] as (() => void) | undefined
  expect(listener).toBeTypeOf('function')
  await vi.advanceTimersByTimeAsync(200) // startup reconciliation of the new baseline: no change
  expect(changed).not.toHaveBeenCalled()
  await writeFile(second, 'second edited')
  now += 1001
  listener!()
  await vi.advanceTimersByTimeAsync(200)
  await vi.waitFor(() => expect(changed).toHaveBeenCalledOnce())
})

it('checks the reloaded dependencies before an unchanged overlapping pass settles', async () => {
  const cache = new OpenCodeDiscoveryCache()
  const first = join(root, 'opencode.json')
  const second = join(root, 'instructions.md')
  await writeFile(first, 'unchanged')
  await writeFile(second, 'second')
  const key = cache.key('configured', root, {})
  await cache.run(key, () => discoveryReadFile(first))
  const changed = vi.fn()
  releases.push(cache.hold(key, changed))
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
    cache.invalidate()
    expect(await cache.run(key, () => discoveryReadFile(second))).toBe('second')
    await writeFile(second, 'second edited')
    now += 1001
  } finally {
    slow.resolve('unchanged')
    await polling
  }
  expect(changed).toHaveBeenCalledOnce()
  await cache.poll()
  expect(changed).toHaveBeenCalledOnce()
  expect(await cache.run(key, () => discoveryReadFile(second))).toBe('second edited')
})
