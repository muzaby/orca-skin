// 0290 r2 verify 재현 — Z03(D7). app/src/main/adapters/opencode/v1/ 로 복사해 실행한다:
//   cd app && ./node_modules/.bin/vitest run src/main/adapters/opencode/v1/discovery-cache.reload-during-poll.verify.test.ts
// 진행 중 poll pass가 의존 파일 변경을 검출하는 동안 다른 소비자의 재로드가 manifest를 바꾼다.
// 구 코드(a2e8464)·r1(0eb7dc2)은 그 pass가 holder에 통보한다(서버 retire). r2 가드는 통보를 버린다.
// 관측은 verify.md r2 §2·§4 — 이 파일은 "통보 1회"를 기대값으로 둔다.
import { mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { discoveryReadFile, openCodeDiscovery, OpenCodeDiscoveryCache } from './discovery-cache'

vi.mock('node:fs/promises', async (original) => {
  const fs = await original<typeof import('node:fs/promises')>()
  return { ...fs, readFile: vi.fn(fs.readFile) }
})

let root: string, now: number
const releases: (() => void)[] = []
beforeEach(() => {
  now = Date.now()
  vi.spyOn(Date, 'now').mockImplementation(() => now)
})
afterEach(async () => {
  for (const release of releases.splice(0)) release()
  openCodeDiscovery.invalidate()
  vi.restoreAllMocks()
  await rm(root, { recursive: true, force: true })
})

it('VERIFY: a held scope is notified when its in-flight poll sees a change that a concurrent reload also reads', async () => {
  root = await realpath(await mkdtemp(join(tmpdir(), 'orca-verify-r2-')))
  const cache = new OpenCodeDiscoveryCache()
  const file = join(root, 'opencode.json')
  await writeFile(file, '{"mcp":{}}')
  const key = cache.key('configured', root, {})
  expect(await cache.run(key, () => discoveryReadFile(file))).toBe('{"mcp":{}}')
  const changed = vi.fn()
  releases.push(cache.hold(key, changed))
  await new Promise((done) => setTimeout(done, 200))
  // The OpenCode server for this scope was started with the empty MCP config; the user edits it.
  await writeFile(file, '{"mcp":{"added":{"enabled":true}}}')
  now += 1001
  const slow = Promise.withResolvers<string>()
  vi.mocked(readFile).mockReturnValueOnce(slow.promise as never)
  const reads = vi.mocked(readFile).mock.calls.length
  const polling = cache.poll()
  try {
    await vi.waitFor(() => expect(vi.mocked(readFile).mock.calls.length).toBe(reads + 1))
    // Another consumer (e.g. a global plugin change) invalidates and reloads the same scope meanwhile.
    cache.invalidate()
    expect(await cache.run(key, () => discoveryReadFile(file))).toBe(
      '{"mcp":{"added":{"enabled":true}}}'
    )
  } finally {
    slow.resolve('{"mcp":{"added":{"enabled":true}}}')
    await polling
  }
  await new Promise((done) => setTimeout(done, 500))
  expect(changed).toHaveBeenCalledOnce()
}, 10000)
