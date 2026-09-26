import { execFile } from 'node:child_process'
import { mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { DbQueries } from '../infra/db'
import { runGit, type GitRunOptions } from '../infra/git/runner'
import { createGitGateway } from '../infra/git/gateway'
import { resolveGitExecutable } from '../infra/git/git-executable'
import { gitCheckout } from '../infra/git/git-cli'
import { gitSnapshot } from '../infra/git/git-snapshot'
import { repairWorktree, removeWorktree, deleteBranch } from '../infra/git/worktree'
import { WorktreeService } from '../features/worktrees/service'
import { FIXTURE_GIT_TIMEOUT_MS, removeTempRoots } from '../infra/git/temp-repo.testfixture'

vi.setConfig({ testTimeout: 180_000, hookTimeout: 180_000 })
const roots: string[] = []
afterEach(() => removeTempRoots(roots.splice(0)))
async function git(cwd: string, ...args: string[]): Promise<string> {
  const result = await runGit(cwd, args, { timeoutMs: FIXTURE_GIT_TIMEOUT_MS })
  if (!result.ok) throw Error(result.stderr)
  return result.stdout.trim()
}
async function repo(): Promise<string> {
  const cwd = await mkdtemp(join(tmpdir(), 'orca-git-execution-'))
  roots.push(cwd)
  await git(cwd, 'init', '--initial-branch=main')
  await git(cwd, 'config', 'user.email', 'test@orca.local')
  await git(cwd, 'config', 'user.name', 'Test')
  await writeFile(join(cwd, 'a.txt'), 'base\n')
  await git(cwd, 'add', '.')
  await git(cwd, 'commit', '-m', 'base')
  return cwd
}
function recording(): {
  calls: Array<{ args: string[]; options?: GitRunOptions }>
  gateway: ReturnType<typeof createGitGateway>
} {
  const calls: Array<{ args: string[]; options?: GitRunOptions }> = []
  const gateway = createGitGateway({
    run: async (cwd, args, options) => {
      calls.push({ args, options })
      return runGit(cwd, args, { ...options, timeoutMs: FIXTURE_GIT_TIMEOUT_MS })
    }
  })
  return { calls, gateway }
}
function assertPolicies(calls: ReturnType<typeof recording>['calls']): void {
  const writes = calls.filter(({ args }) =>
    ['checkout', 'stash', 'commit', 'reset', 'worktree', 'branch'].includes(args[0])
  )
  expect(writes.length).toBeGreaterThan(0)
  expect(
    writes.filter(({ args, options }) => args.includes('--no-optional-locks') || options?.readOnly)
  ).toEqual([])
  const reads = calls.filter((call) => !writes.includes(call))
  expect(
    reads.filter(({ args, options }) => args[0] !== '--no-optional-locks' || !options?.readOnly)
  ).toEqual([])
}
describe('Git entry point execution budgets and write policy', () => {
  it('checkout returns post-switch status in five executions; unresolved dirty state uses two', async () => {
    const cwd = await repo()
    await git(cwd, 'branch', 'feature')
    const { calls, gateway } = recording()
    const checkout = await gitCheckout(cwd, 'feature', undefined, gateway)
    expect(checkout).toMatchObject({ ok: true, status: { branch: 'feature', isRepo: true } })
    expect(calls.map(({ args }) => args.find((arg) => !arg.startsWith('-')))).toEqual([
      'rev-parse',
      'diff',
      'checkout',
      'rev-parse',
      'remote'
    ])
    assertPolicies(calls)
    if (!checkout.ok) throw Error('Expected successful checkout')
    expect((await gitSnapshot({ cwd, includeSummary: false }, gateway)).status).toEqual(
      checkout.status
    )
    calls.length = 0
    await writeFile(join(cwd, 'a.txt'), 'dirty\n')
    expect(await gitCheckout(cwd, 'main', undefined, gateway)).toMatchObject({
      ok: false,
      reason: 'dirty'
    })
    expect(calls).toHaveLength(2)
    expect(calls[1].args).toEqual([
      '--no-optional-locks',
      'diff',
      '--no-ext-diff',
      '--no-textconv',
      'HEAD',
      '--shortstat'
    ])
    for (const resolution of ['stash', 'commit-wip', 'discard'] as const) {
      await git(cwd, 'checkout', 'main')
      await writeFile(join(cwd, 'a.txt'), `${resolution}\n`)
      calls.length = 0
      expect(await gitCheckout(cwd, 'feature', resolution, gateway)).toMatchObject({
        ok: true,
        status: { branch: 'feature' }
      })
      expect(calls).toHaveLength(6)
      assertPolicies(calls)
    }
  })

  it('prepares without baseRef in four executions and routes all worktree writes through mutation', async () => {
    const cwd = await repo()
    const { calls, gateway } = recording()
    let row!: { worktreeRoot: string; branch: string }
    const db = {
      insertManagedWorktree: (value: typeof row): void => {
        row = value
      }
    } as unknown as DbQueries
    const service = new WorktreeService(db, join(cwd, 'managed'), undefined, gateway)
    expect((await service.prepare({ sourceCwd: cwd, firstPrompt: 'work' })).kind).toBe('managed')
    expect(calls.map(({ args }) => args.find((arg) => !arg.startsWith('-')))).toEqual([
      'rev-parse',
      'check-ref-format',
      'show-ref',
      'worktree'
    ])
    expect(gateway.generation()).toBe(1)
    expect((await repairWorktree(cwd, row.worktreeRoot, gateway)).ok).toBe(true)
    expect((await removeWorktree({ repoRoot: cwd, path: row.worktreeRoot }, gateway)).ok).toBe(true)
    expect((await deleteBranch({ repoRoot: cwd, branch: row.branch }, gateway)).ok).toBe(true)
    expect(gateway.generation()).toBe(4)
    assertPolicies(calls)
  })

  it('reports unavailable without spawning and discovers Git on a later request', async () => {
    const cwd = await repo()
    let available = false
    const spawn = vi.fn(execFile)
    const gateway = createGitGateway({
      run: (dir, args, options) =>
        runGit(dir, args, {
          ...options,
          timeoutMs: FIXTURE_GIT_TIMEOUT_MS,
          execFileImpl: spawn as unknown as typeof execFile,
          resolveExecutable: () =>
            resolveGitExecutable({ env: available ? process.env : { PATH: '' } })
        })
    })
    const service = new WorktreeService({} as DbQueries, join(cwd, 'managed'), undefined, gateway)
    expect(await service.prepare({ sourceCwd: cwd, firstPrompt: 'work' })).toMatchObject({
      kind: 'rejected',
      reason: 'git-unavailable'
    })
    expect(spawn).not.toHaveBeenCalled()
    available = true
    expect((await gitSnapshot({ cwd, includeSummary: false }, gateway)).status.isRepo).toBe(true)
    expect(spawn).toHaveBeenCalledTimes(2)
  })
})
