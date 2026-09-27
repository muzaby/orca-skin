import { describe, expect, it, vi } from 'vitest'
import { createGitGateway } from '../gateway'
import type { GitRunResult } from '../runner'

const OK: GitRunResult = { ok: true, stdout: '', stderr: '', code: null, aborted: false }
describe('verifier probes 0241', () => {
  it('P2 sustained load never exceeds 4 active reads', async () => {
    let active = 0
    let max = 0
    const resolvers: Array<() => void> = []
    const gateway = createGitGateway({
      run: async () => {
        max = Math.max(max, ++active)
        await new Promise<void>((r) => resolvers.push(r))
        active--
        return OK
      }
    })
    const reads: Promise<unknown>[] = []
    for (let i = 0; i < 6; i++) reads.push(gateway.read('/r', ['a', String(i)]))
    await vi.waitFor(() => expect(resolvers.length).toBe(4))
    for (let step = 0; step < 6; step++) {
      resolvers.shift()!()
      for (let k = 0; k < 2; k++) reads.push(gateway.read('/r', ['b', String(step), String(k)]))
      await new Promise((r) => setTimeout(r, 5))
    }
    while (resolvers.length || active) {
      resolvers.shift()?.()
      await new Promise((r) => setTimeout(r, 2))
    }
    await Promise.all(reads)
    expect(max).toBe(4)
  })
  it('P3 production executable lookup re-resolves after a miss', async () => {
    const saved = process.env.PATH
    vi.resetModules()
    const mod = await import('../git-executable')
    process.env.PATH = ''
    expect(await mod.gitExecutable()).toBeNull()
    process.env.PATH = saved
    expect(await mod.gitExecutable()).toMatch(/git$/)
  })
})
