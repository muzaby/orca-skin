import { mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { gitSnapshot } from './git-snapshot'
import { gitDiffPatch } from './git-diff'
import { createGitGateway } from './gateway'
import { runGit } from './runner'
import { FIXTURE_GIT_TIMEOUT_MS, removeTempRoots } from './temp-repo.testfixture'

vi.setConfig({ testTimeout: 120_000, hookTimeout: 120_000 })
const roots: string[] = []
afterEach(() => removeTempRoots(roots.splice(0)))
async function git(cwd: string, ...args: string[]): Promise<string> {
  const result = await runGit(cwd, args, { timeoutMs: FIXTURE_GIT_TIMEOUT_MS })
  if (!result.ok) throw Error(result.stderr)
  return result.stdout.trim()
}
async function repo(): Promise<string> {
  const cwd = await mkdtemp(join(tmpdir(), 'orca-snapshot-'))
  roots.push(cwd)
  await git(cwd, 'init', '--initial-branch=main')
  await git(cwd, 'config', 'user.email', 'test@orca.local')
  await git(cwd, 'config', 'user.name', 'Test')
  await git(cwd, 'commit', '--allow-empty', '-m', 'base')
  return cwd
}
describe('snapshot request execution budget', () => {
  it('bounds missing/non-repository/unborn probes and repeats legacy date lookup', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'orca-snapshot-states-'))
    roots.push(cwd)
    const run = vi.fn(runGit)
    const gateway = createGitGateway({ run })
    expect(
      (await gitSnapshot({ cwd: join(cwd, 'missing'), includeSummary: true }, gateway)).status
        .isRepo
    ).toBe(false)
    expect(run).not.toHaveBeenCalled()
    expect((await gitSnapshot({ cwd, includeSummary: true }, gateway)).status.isRepo).toBe(false)
    expect(run).toHaveBeenCalledTimes(2)
    await git(cwd, 'init', '--initial-branch=main')
    run.mockClear()
    const unborn = await gitSnapshot({ cwd, includeSummary: true }, gateway)
    expect(unborn.status).toMatchObject({ isRepo: true, branch: 'main', detached: false })
    expect(unborn.summary?.base).toEqual({ kind: 'none' })
    expect(run).toHaveBeenCalledTimes(4)
    const born = await repo()
    for (let n = 0; n < 2; n++) {
      run.mockClear()
      const result = await gitSnapshot(
        { cwd: born, bornAt: Date.now() + 60_000, includeSummary: true },
        gateway
      )
      expect(result.summary?.files).toEqual([])
      expect(run).toHaveBeenCalledTimes(3)
      expect(run.mock.calls.filter((call) => call[1].includes('rev-list'))).toHaveLength(1)
    }
    for (let n = 0; n < 2; n++) {
      run.mockClear()
      const result = await gitSnapshot({ cwd: born, bornAt: 0, includeSummary: true }, gateway)
      expect(result.summary?.commits).toHaveLength(1)
      expect(run).toHaveBeenCalledTimes(5)
      const args = run.mock.calls.find((call) => call[1].includes('rev-list'))![1]
      expect(args.at(-1)).toBe(await git(born, 'rev-parse', 'HEAD'))
    }
  })
  it('runs probe + origin on every equal-baseline and status-only request, without a completed result cache', async () => {
    const cwd = await repo()
    const baseOid = await git(cwd, 'rev-parse', 'HEAD')
    const run = vi.fn(runGit)
    const gateway = createGitGateway({ run })
    for (let n = 0; n < 2; n++) {
      run.mockClear()
      const result = await gitSnapshot({ cwd, baseOid, includeSummary: true }, gateway)
      expect(run).toHaveBeenCalledTimes(2)
      expect(run.mock.calls.map((call) => call[1][1])).toEqual(['rev-parse', 'remote'])
      expect(result.summary).toMatchObject({
        files: [],
        commits: [],
        totals: { added: 0, removed: 0 }
      })
    }
    await git(cwd, 'remote', 'add', 'origin', 'https://github.com/first/repo.git')
    expect((await gitSnapshot({ cwd, includeSummary: false }, gateway)).status.githubUrl).toBe(
      'https://github.com/first/repo'
    )
    await git(cwd, 'remote', 'set-url', 'origin', 'https://github.com/second/repo.git')
    run.mockClear()
    const result = await gitSnapshot({ cwd, includeSummary: false }, gateway)
    expect(run).toHaveBeenCalledTimes(2)
    expect(run.mock.calls.map((call) => call[1][1])).toEqual(['rev-parse', 'remote'])
    expect(result.summary).toBeNull()
    expect(result.status.githubUrl).toBe('https://github.com/second/repo')
  })
  it('uses four calls for changed snapshots, two for cumulative patch and three for selected patch', async () => {
    const cwd = await repo()
    const baseOid = await git(cwd, 'rev-parse', 'HEAD')
    const run = vi.fn(runGit)
    const gateway = createGitGateway({ run })
    expect(
      (await gitSnapshot({ cwd, baseOid, includeSummary: true }, gateway)).summary?.commits
    ).toEqual([])
    expect(run.mock.calls.map((call) => call[1][1])).toEqual(['rev-parse', 'remote'])
    await writeFile(join(cwd, 'a.txt'), 'one\n')
    await git(cwd, 'add', '.')
    await git(cwd, 'commit', '-m', 'change')
    const commitSha = await git(cwd, 'rev-parse', 'HEAD')
    for (let n = 0; n < 2; n++) {
      run.mockClear()
      const result = await gitSnapshot({ cwd, baseOid, includeSummary: true }, gateway)
      expect(run).toHaveBeenCalledTimes(4)
      expect(run.mock.calls.map((call) => call[1][1]).sort()).toEqual([
        'diff',
        'log',
        'remote',
        'rev-parse'
      ])
      expect(result.summary?.totals).toEqual({ added: 1, removed: 0 })
      expect(result.summary?.commits.map((c) => c.sha)).toEqual([commitSha])
    }
    for (let n = 0; n < 2; n++) {
      run.mockClear()
      expect((await gitDiffPatch({ cwd, baseOid }, gateway.read)).files[0].added).toBe(1)
      expect(
        run.mock.calls.map((call) => (call[1].includes('diff') ? 'diff' : call[1][1]))
      ).toEqual(['rev-parse', 'diff'])
      run.mockClear()
      expect((await gitDiffPatch({ cwd, commitSha }, gateway.read)).files[0].added).toBe(1)
      expect(
        run.mock.calls.map((call) => (call[1].includes('diff') ? 'diff' : call[1][1]))
      ).toEqual(['rev-parse', 'cat-file', 'diff'])
      run.mockClear()
      expect((await gitDiffPatch({ cwd, baseOid: commitSha }, gateway.read)).files).toEqual([])
      expect(run.mock.calls.map((call) => call[1][1])).toEqual(['rev-parse'])
    }
  })
})
