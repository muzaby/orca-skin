import { mkdtemp, writeFile, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { runGit } from './runner'
import { createGitGateway } from './gateway'
import { gitSnapshot } from './git-snapshot'
import { gitDiffPatch } from './git-diff'
import { execGit, FIXTURE_GIT_TIMEOUT_MS, removeTempRoots } from './temp-repo.testfixture'

vi.setConfig({ testTimeout: 150_000, hookTimeout: 150_000 })
const roots: string[] = []
afterEach(async () => {
  vi.unstubAllEnvs()
  await removeTempRoots(roots.splice(0))
})
const git = async (cwd: string, ...args: string[]): Promise<string> => {
  const result = await runGit(cwd, args, { timeoutMs: FIXTURE_GIT_TIMEOUT_MS })
  if (!result.ok) throw Error(result.stderr)
  return result.stdout.trim()
}
async function commit(cwd: string, count: number, date = '2001-01-01T00:00:00Z'): Promise<string> {
  await writeFile(
    join(cwd, 'lines.txt'),
    Array.from({ length: count }, (_, i) => `line ${i}\n`).join('')
  )
  await git(cwd, 'add', '.')
  await execGit('git', ['commit', '-m', `lines ${count}`], {
    cwd,
    timeout: FIXTURE_GIT_TIMEOUT_MS,
    env: { ...process.env, GIT_COMMITTER_DATE: date, GIT_AUTHOR_DATE: date }
  })
  return git(cwd, 'rev-parse', 'HEAD')
}
async function repo(): Promise<{ cwd: string; baseOid: string; selected: string; head: string }> {
  const cwd = await mkdtemp(join(tmpdir(), 'orca-consistency-'))
  roots.push(cwd)
  await git(cwd, 'init', '--initial-branch=main')
  await git(cwd, 'config', 'user.email', 'test@orca.local')
  await git(cwd, 'config', 'user.name', 'Test')
  await git(cwd, 'config', 'core.autocrlf', 'false')
  const baseOid = await commit(cwd, 1, '2000-01-01T00:00:00Z')
  const selected = await commit(cwd, 3)
  const head = await commit(cwd, 6)
  return { cwd, baseOid, selected, head }
}
const failure = { ok: false, stdout: '', stderr: 'injected limit', code: 1, aborted: false }

describe('request OIDs survive external commits', () => {
  it.each(['summary', 'history-fallback', 'bornAt', 'patch', 'selected'] as const)(
    '%s pins results after the completed probe',
    async (mode) => {
      const { cwd, baseOid, selected, head } = await repo()
      const calls: string[][] = []
      const order: string[] = []
      let injected = false
      const gateway = createGitGateway({
        run: async (dir, args, options) => {
          calls.push([...args])
          expect(options?.readOnly).toBe(true)
          expect(args[0]).toBe('--no-optional-locks')
          if (mode === 'history-fallback' && args.includes('log') && args.includes('--raw'))
            return failure
          const result = await runGit(dir, args, { ...options, timeoutMs: FIXTURE_GIT_TIMEOUT_MS })
          if (args.includes('--is-inside-work-tree') && !injected) {
            injected = true
            const observed = result.stdout.trim().split(/\r?\n/)[4]
            expect(observed).toBe(head)
            order.push('probe-complete')
            const changed = await commit(cwd, 10, '2000-06-01T00:00:00Z')
            expect(changed).not.toBe(observed)
            order.push('head-changed')
          } else order.push('read')
          return result
        }
      })
      if (mode === 'patch' || mode === 'selected') {
        const result = await gitDiffPatch(
          { cwd, baseOid, ...(mode === 'selected' ? { commitSha: selected } : {}) },
          gateway.read
        )
        expect(result.files[0].added).toBe(mode === 'selected' ? 2 : 5)
        expect(result.files[0].lines.filter((line) => line.type === 'added')).toHaveLength(
          mode === 'selected' ? 2 : 5
        )
        if (mode === 'selected')
          expect(result.base).toEqual({ kind: 'commit-parent', oid: baseOid, commitOid: selected })
      } else {
        const result = await gitSnapshot(
          {
            cwd,
            includeSummary: true,
            ...(mode === 'bornAt' ? { bornAt: Date.parse('2000-07-01T00:00:00Z') } : { baseOid })
          },
          gateway
        )
        expect(result.summary?.totals).toEqual({ added: 5, removed: 0 })
        expect(result.summary?.commits.map((c) => c.sha)).toEqual([head, selected])
        expect(result.summary?.base).toEqual({ kind: 'worktree-base', oid: baseOid, ref: null })
        expect(result.summary?.commitFilesUnavailable).toBe(mode === 'history-fallback')
      }
      expect(order.slice(0, 2)).toEqual(['probe-complete', 'head-changed'])
      expect(order.slice(2)).toContain('read')
      const rangeCalls = calls.filter(
        (args) =>
          !args.includes('--is-inside-work-tree') &&
          !args.includes('remote') &&
          !args.includes('symbolic-ref')
      )
      expect(rangeCalls.length).toBeGreaterThan(0)
      expect(rangeCalls.flat().filter((arg) => /^HEAD/.test(arg) || /\.\.HEAD$/.test(arg))).toEqual(
        []
      )
      const diffs = rangeCalls.filter((args) => args.includes('diff') || args.includes('log'))
      expect(
        diffs.filter((args) => !args.includes('--no-ext-diff') || !args.includes('--no-textconv'))
      ).toEqual([])
    }
  )

  it.each(['cumulative', 'selected'] as const)(
    '%s fallback preserves the pair when HEAD changes between attempts',
    async (mode) => {
      const { cwd, baseOid, selected, head } = await repo()
      const attempts: string[][] = []
      const gateway = createGitGateway({
        run: async (dir, args, options) => {
          if (args.includes('diff')) attempts.push([...args])
          if (args.includes('--unified=1000000')) {
            expect(await git(cwd, 'rev-parse', 'HEAD')).toBe(head)
            expect(await commit(cwd, 10)).not.toBe(head)
            return failure
          }
          return runGit(dir, args, { ...options, timeoutMs: FIXTURE_GIT_TIMEOUT_MS })
        }
      })
      const result = await gitDiffPatch(
        { cwd, baseOid, ...(mode === 'selected' ? { commitSha: selected } : {}) },
        gateway.read
      )
      expect(result.contextLimited).toBe(true)
      expect(result.unavailable).toBe(false)
      expect(result.files[0].added).toBe(mode === 'selected' ? 2 : 5)
      expect(attempts).toHaveLength(2)
      expect(attempts[0].filter((arg) => !arg.startsWith('--unified='))).toEqual(
        attempts[1].filter((arg) => !arg.startsWith('--unified='))
      )
      expect(attempts[1].slice(-2)).toEqual([baseOid, mode === 'selected' ? selected : head])
      expect(
        attempts.every((args) => args.includes('--no-ext-diff') && args.includes('--no-textconv'))
      ).toBe(true)
    }
  )

  it('reads global insteadOf changes without any local config change', async () => {
    const { cwd } = await repo()
    const globalConfig = join(cwd, 'global-config')
    vi.stubEnv('GIT_CONFIG_GLOBAL', globalConfig)
    await git(cwd, 'remote', 'add', 'origin', 'alias:owner/repo.git')
    const localBefore = await readFile(join(cwd, '.git', 'config'), 'utf8')
    await writeFile(globalConfig, '[url "https://github.com/"]\n\tinsteadOf = alias:\n')
    expect((await gitSnapshot({ cwd, includeSummary: false })).status.githubUrl).toBe(
      'https://github.com/owner/repo'
    )
    await writeFile(globalConfig, '[url "https://github.company.com/"]\n\tinsteadOf = alias:\n')
    expect((await gitSnapshot({ cwd, includeSummary: false })).status.githubUrl).toBe(
      'https://github.company.com/owner/repo'
    )
    expect(await readFile(join(cwd, '.git', 'config'), 'utf8')).toBe(localBefore)
  })
})
