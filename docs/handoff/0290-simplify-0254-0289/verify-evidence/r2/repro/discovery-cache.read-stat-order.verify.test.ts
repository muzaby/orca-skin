// 0290 r2 verify 재현 — Z01(D6). app/src/main/adapters/opencode/v1/ 로 복사해 실행한다:
//   cd app && ./node_modules/.bin/vitest run src/main/adapters/opencode/v1/discovery-cache.read-stat-order.verify.test.ts
// 소비자가 내용을 읽은 직후·의존성 등록 전에 편집이 들어오면, 감시 기준선(stat)이 읽기보다 앞서야 통보된다.
// 관측: HEAD(c6070f4) 통과 · Z01(stat을 내용 읽기 뒤로) 실패 · 기존 스위트는 Z01에서도 전부 통과.
import { mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, expect, it, vi } from 'vitest'
import { discoveryReadFile, openCodeDiscovery, OpenCodeDiscoveryCache } from './discovery-cache'

vi.mock('node:fs/promises', async (original) => {
  const fs = await original<typeof import('node:fs/promises')>()
  return { ...fs, readFile: vi.fn(fs.readFile) }
})

let root: string
const releases: (() => void)[] = []
afterEach(async () => {
  for (const release of releases.splice(0)) release()
  openCodeDiscovery.invalidate()
  await rm(root, { recursive: true, force: true })
})

it('VERIFY: notifies a holder about an edit that lands right after the content read', async () => {
  root = await realpath(await mkdtemp(join(tmpdir(), 'orca-verify-r2-')))
  const cache = new OpenCodeDiscoveryCache()
  const file = join(root, 'opencode.json')
  await writeFile(file, '{"mcp":{}}')
  const key = cache.key('configured', root, {})
  const actual = await vi.importActual<typeof import('node:fs/promises')>('node:fs/promises')
  vi.mocked(readFile).mockImplementationOnce((async (...args: Parameters<typeof actual.readFile>) => {
    const value = await actual.readFile(...args)
    // e.g. the editor saves opencode.json while Orca is still assembling the server settings
    await actual.writeFile(file, '{"mcp":{"added":{"enabled":true}}}')
    return value
  }) as typeof readFile)
  expect(await cache.run(key, () => discoveryReadFile(file))).toBe('{"mcp":{}}')
  const changed = vi.fn()
  releases.push(cache.hold(key, changed))
  await vi.waitFor(() => expect(changed).toHaveBeenCalledOnce(), { timeout: 4000, interval: 100 })
}, 10000)
