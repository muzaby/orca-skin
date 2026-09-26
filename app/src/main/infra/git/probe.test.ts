import { mkdtemp, mkdir, realpath } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { execGit, removeTempRoots } from './temp-repo.testfixture'
import { probeRepo } from './probe'
import { createGitGateway } from './gateway'

vi.setConfig({ testTimeout: 90_000, hookTimeout: 90_000 })
const roots: string[] = []
afterEach(() => removeTempRoots(roots.splice(0)))
const git = (cwd: string, ...args: string[]): Promise<unknown> =>
  execGit('git', ['-C', cwd, ...args])
async function repo(): Promise<string> {
  const cwd = await mkdtemp(join(tmpdir(), 'orca-probe-'))
  roots.push(cwd)
  await git(cwd, 'init', '--initial-branch=main')
  await git(cwd, 'config', 'user.email', 'test@orca.local')
  await git(cwd, 'config', 'user.name', 'Test')
  return cwd
}
describe('probeRepo', () => {
  it('reports unborn and born branch identity, nested coordinates, and detached HEAD', async () => {
    const cwd = await repo()
    expect(await probeRepo(cwd)).toMatchObject({
      kind: 'repo',
      head: { kind: 'unborn', name: 'main' }
    })
    await git(cwd, 'commit', '--allow-empty', '-m', 'base')
    const born = await probeRepo(cwd)
    expect(born).toMatchObject({
      kind: 'repo',
      root: await realpath(cwd),
      head: { kind: 'branch', name: 'main', oid: expect.stringMatching(/^[a-f0-9]{40}$/) }
    })
    const nested = join(cwd, 'nested')
    await mkdir(nested)
    expect(await probeRepo(nested)).toEqual(born)
    await git(cwd, 'checkout', '--detach')
    expect(await probeRepo(cwd)).toMatchObject({ kind: 'repo', head: { kind: 'detached' } })
  })
  it('distinguishes linked worktree gitDir from commonDir', async () => {
    const cwd = await repo()
    await git(cwd, 'commit', '--allow-empty', '-m', 'base')
    const linked = join(cwd, 'linked')
    await git(cwd, 'worktree', 'add', '-b', 'linked', linked)
    const main = await probeRepo(cwd)
    const worktree = await probeRepo(linked)
    if (main.kind !== 'repo' || worktree.kind !== 'repo') throw new Error('repo expected')
    expect(worktree.commonDir).toBe(main.commonDir)
    expect(worktree.gitDir).not.toBe(main.gitDir)
    expect(worktree.head).toMatchObject({ kind: 'branch', name: 'linked' })
  })
  it('does not execute for missing directories and distinguishes absent git', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'orca-probe-plain-'))
    roots.push(cwd)
    expect(await probeRepo(cwd)).toEqual({ kind: 'not-repo' })
    const run = vi.fn(async () => ({
      ok: false,
      stdout: '',
      stderr: '',
      code: null,
      aborted: false,
      unavailable: true as const
    }))
    const gateway = createGitGateway({ run })
    expect(await probeRepo(join(cwd, 'missing'), gateway)).toEqual({ kind: 'not-repo' })
    expect(run).not.toHaveBeenCalled()
    expect(await probeRepo(cwd, gateway)).toEqual({ kind: 'unavailable' })
    expect(run).toHaveBeenCalledOnce()
  })
})
