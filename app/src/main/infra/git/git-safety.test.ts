import { copyFile, mkdtemp, readFile, stat, unlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { delimiter, dirname, join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createGitGateway } from './gateway'
import { resolveGitExecutable } from './git-executable'
import { gitSnapshot } from './git-snapshot'
import { gitDiffPatch } from './git-diff'
import { gitCheckout } from './git-cli'
import { runGit } from './runner'
import { execGit, FIXTURE_GIT_TIMEOUT_MS, removeTempRoots } from './temp-repo.testfixture'

vi.setConfig({ testTimeout: 150_000, hookTimeout: 150_000 })
const roots: string[] = []
afterEach(() => removeTempRoots(roots.splice(0)))
async function root(): Promise<string> {
  const cwd = await mkdtemp(join(tmpdir(), 'orca-git-safety-'))
  roots.push(cwd)
  return cwd
}
async function git(cwd: string, ...args: string[]): Promise<string> {
  const result = await runGit(cwd, args, { timeoutMs: FIXTURE_GIT_TIMEOUT_MS })
  if (!result.ok) throw Error(result.stderr)
  return result.stdout.trim()
}
describe('Git execution safety', () => {
  it('never runs a cwd executable through relative PATH entries', async () => {
    const cwd = await root()
    const marker = join(cwd, 'marker')
    const script = join(cwd, 'marker.cjs')
    await writeFile(script, `require('fs').writeFileSync(${JSON.stringify(marker)}, 'ran')`)
    const fake = join(cwd, process.platform === 'win32' ? 'git.exe' : 'git')
    // A valid executable is important: an invalid .exe could pass without the resolver guard.
    await copyFile(process.execPath, fake)
    await execGit(fake, [script], { cwd, timeout: FIXTURE_GIT_TIMEOUT_MS })
    expect(await readFile(marker, 'utf8')).toBe('ran')
    await unlink(marker)
    const realGit = await resolveGitExecutable()
    if (!realGit) throw Error('Git fixture unavailable')
    const env = { PATH: ['.', '', 'relative', dirname(realGit)].join(delimiter) }
    const executable = await resolveGitExecutable({ env })
    expect(executable).toBe(realGit)
    const result = await runGit(cwd, [script], {
      resolveExecutable: () => resolveGitExecutable({ env }),
      timeoutMs: FIXTURE_GIT_TIMEOUT_MS
    })
    expect(result.ok).toBe(false)
    expect(await stat(marker).catch(() => null)).toBeNull()
  })

  it('blocks configured external diff/textconv helpers and keeps every read non-locking', async () => {
    const cwd = await root()
    await git(cwd, 'init', '--initial-branch=main')
    await git(cwd, 'config', 'user.email', 'test@orca.local')
    await git(cwd, 'config', 'user.name', 'Test')
    await writeFile(join(cwd, 'a.txt'), 'before\n')
    await git(cwd, 'add', '.')
    await git(cwd, 'commit', '-m', 'base')
    const baseOid = await git(cwd, 'rev-parse', 'HEAD')
    await writeFile(join(cwd, 'a.txt'), 'after\n')
    await git(cwd, 'commit', '-am', 'change')
    const marker = join(cwd, 'marker')
    const helper = join(cwd, 'helper.cjs')
    await writeFile(
      helper,
      `require('fs').writeFileSync(${JSON.stringify(marker)}, 'ran'); process.stdout.write('converted\\n')`
    )
    const command = `"${process.execPath.replaceAll('\\', '/')}" "${helper.replaceAll('\\', '/')}"`
    await git(cwd, 'config', 'diff.external', command)
    await git(cwd, 'diff', baseOid, 'HEAD')
    expect(await readFile(marker, 'utf8')).toBe('ran')
    await unlink(marker)
    await git(cwd, 'config', '--unset', 'diff.external')
    await writeFile(join(cwd, '.gitattributes'), '*.txt diff=marker\n')
    await git(cwd, 'config', 'diff.marker.textconv', command)
    await git(cwd, 'diff', baseOid, 'HEAD')
    expect(await readFile(marker, 'utf8')).toBe('ran')
    await unlink(marker)
    await git(cwd, 'config', 'diff.external', command)
    const calls: string[][] = []
    const gateway = createGitGateway({
      run: async (dir, args, options) => {
        calls.push(args)
        expect(options?.readOnly).toBe(true)
        return runGit(dir, args, { ...options, timeoutMs: FIXTURE_GIT_TIMEOUT_MS })
      }
    })
    expect(
      (await gitSnapshot({ cwd, baseOid, includeSummary: true }, gateway)).summary?.totals
    ).toEqual({ added: 1, removed: 1 })
    expect((await gitDiffPatch({ cwd, baseOid }, gateway.read)).files[0].added).toBe(1)
    await writeFile(join(cwd, 'a.txt'), 'working\n')
    expect(await gitCheckout(cwd, 'main', undefined, gateway)).toMatchObject({
      ok: false,
      reason: 'dirty'
    })
    expect(await stat(marker).catch(() => null)).toBeNull()
    expect(calls.filter((args) => args[0] !== '--no-optional-locks')).toEqual([])
    const rangeCalls = calls.filter((args) => args.includes('diff') || args.includes('log'))
    expect(rangeCalls).toHaveLength(4)
    expect(
      rangeCalls.filter(
        (args) => !args.includes('--no-ext-diff') || !args.includes('--no-textconv')
      )
    ).toEqual([])
  })
})
