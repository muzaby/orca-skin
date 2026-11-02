// 0290 r3 verify — repro D (verifier axis outside the r3 report; evidence for X07).
// After a hold, a reload makes the scope depend on another file. An edit to that file must reach
// the holder through the real file watcher (no direct poll() call, real timers).
// Copied into app/src/main/adapters/opencode/v1/ only while running; not part of the app suite.
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

it('notifies an edit to the dependency file a reload switched to', async () => {
  root = await realpath(await mkdtemp(join(tmpdir(), 'orca-verify-rewatch-')))
  const cache = new OpenCodeDiscoveryCache()
  const first = join(root, 'opencode.json')
  const second = join(root, 'instructions.md')
  await writeFile(first, 'first')
  await writeFile(second, 'second')
  let target = first
  const key = cache.key('configured', root, {})
  await cache.run(key, () => discoveryReadFile(target))
  const changed = vi.fn()
  releases.push(cache.hold(key, changed))
  // e.g. opencode.json now points at another instructions file; an unrelated dirty signal reloads.
  target = second
  cache.invalidate()
  expect(await cache.run(key, () => discoveryReadFile(target))).toBe('second')
  await new Promise((done) => setTimeout(done, 50))
  await writeFile(second, 'second edited')
  await vi.waitFor(() => expect(changed).toHaveBeenCalledOnce(), { timeout: 4000, interval: 100 })
}, 10000)
