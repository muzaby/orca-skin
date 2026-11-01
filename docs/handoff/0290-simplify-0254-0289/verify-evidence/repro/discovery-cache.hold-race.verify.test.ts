// 0290 r1 verify 재현 — D1. app/src/main/adapters/opencode/v1/ 로 복사해 실행한다:
//   cd app && ./node_modules/.bin/vitest run src/main/adapters/opencode/v1/discovery-cache.hold-race.verify.test.ts
// 관측(4d308eb): V1 실패(changed 0회/4s) · V2 통과. 구현 전 discovery-cache.ts(a2e8464)로는 V1·V2 모두 통과.
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

it('V1: notifies a holder about a dependency change made after load but before hold', async () => {
  root = await realpath(await mkdtemp(join(tmpdir(), 'orca-verify-')))
  const cache = new OpenCodeDiscoveryCache()
  const file = join(root, 'opencode.json')
  await writeFile(file, '{"mcp":{}}')
  const key = cache.key('configured', root, {})
  expect(await cache.run(key, () => discoveryReadFile(file))).toBe('{"mcp":{}}')
  await new Promise((done) => setTimeout(done, 20))
  // e.g. the user edits opencode.json while the OpenCode server is still starting
  await writeFile(file, '{"mcp":{"added":{"enabled":true}}}')
  const changed = vi.fn()
  releases.push(cache.hold(key, changed))
  await vi.waitFor(() => expect(changed).toHaveBeenCalled(), { timeout: 4000, interval: 100 })
}, 10000)

it('V2 (control): notifies a holder about a dependency change made after hold', async () => {
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
  await vi.waitFor(() => expect(changed).toHaveBeenCalled(), { timeout: 4000, interval: 100 })
}, 10000)
