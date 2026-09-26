import { describe, expect, it, vi } from 'vitest'
import { createGitGateway } from './gateway'
import type { GitRunResult } from './runner'

const OK: GitRunResult = { ok: true, stdout: '', stderr: '', code: null, aborted: false }
function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

describe('Git gateway', () => {
  it('shares only in-flight reads, pins the generation, and clears completed results', async () => {
    const pending = deferred<GitRunResult>()
    const run = vi.fn(async () => pending.promise)
    const gateway = createGitGateway({ run })
    const first = gateway.read('/repo', ['status'])
    const shared = gateway.read('/repo', ['status'])
    await vi.waitFor(() => expect(run).toHaveBeenCalledTimes(1))
    await gateway.mutate('/repo', async () => OK)
    const afterWrite = gateway.read('/repo', ['status'])
    await vi.waitFor(() => expect(run).toHaveBeenCalledTimes(2))
    pending.resolve(OK)
    await Promise.all([first, shared, afterWrite])
    await gateway.read('/repo', ['status'])
    expect(run).toHaveBeenCalledTimes(3)
  })

  it('bounds distinct reads to four active executions', async () => {
    const pending = deferred<GitRunResult>()
    let active = 0
    let maximum = 0
    const gateway = createGitGateway({
      run: async () => {
        maximum = Math.max(maximum, ++active)
        const result = await pending.promise
        active--
        return result
      }
    })
    const reads = Array.from({ length: 10 }, (_, i) => gateway.read('/repo', ['log', String(i)]))
    await vi.waitFor(() => expect(active).toBe(4))
    pending.resolve(OK)
    await Promise.all(reads)
    expect(maximum).toBe(4)
  })

  it('applies read flags centrally, keeps writes outside the read semaphore, and advances failed writes', async () => {
    const run = vi.fn(async () => OK)
    const gateway = createGitGateway({ run })
    await gateway.read('/repo', ['diff'])
    expect(run).toHaveBeenLastCalledWith(
      '/repo',
      ['--no-optional-locks', 'diff'],
      expect.objectContaining({ readOnly: true })
    )
    await gateway.mutate('/repo', (write) => write('/repo', ['checkout', 'main']))
    expect(run).toHaveBeenLastCalledWith(
      '/repo',
      ['checkout', 'main'],
      expect.not.objectContaining({ readOnly: true })
    )
    expect(gateway.generation()).toBe(1)
    await expect(
      gateway.mutate('/repo', async () => {
        throw new Error('failed')
      })
    ).rejects.toThrow('failed')
    expect(gateway.generation()).toBe(2)
  })

  it('runs a write while all read slots are occupied', async () => {
    const pending = deferred<GitRunResult>()
    const run = vi.fn(async (_cwd: string, args: string[]) =>
      args.includes('--no-optional-locks') ? pending.promise : OK
    )
    const gateway = createGitGateway({ run })
    const reads = Array.from({ length: 4 }, (_, index) =>
      gateway.read('/repo', ['log', String(index)])
    )
    await vi.waitFor(() => expect(run).toHaveBeenCalledTimes(4))
    try {
      await expect(
        gateway.mutate('/repo', (write) => write('/repo', ['checkout', 'main']))
      ).resolves.toEqual(OK)
      expect(run).toHaveBeenCalledTimes(5)
    } finally {
      pending.resolve(OK)
      await Promise.all(reads)
    }
  })
})
