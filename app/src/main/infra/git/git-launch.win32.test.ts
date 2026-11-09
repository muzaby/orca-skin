import { mkdir, readFile, writeFile, access } from 'node:fs/promises'
import { join, win32 } from 'node:path'
import { afterEach, expect, it, vi } from 'vitest'
import { scaledBudget } from '../../../../scripts/test-time.mjs'
import {
  createRepo,
  execGit,
  FIXTURE_GIT_TIMEOUT_MS,
  removeTempRoots
} from './temp-repo.testfixture'
import { gitCommand, resolveGitExecutable } from './git-executable'
import { gitCheckout } from './git-cli'
import { runGit } from './runner'

vi.setConfig(scaledBudget({ testTimeout: 180_000, hookTimeout: 180_000 }))
const roots: string[] = []
afterEach(async () => {
  await removeTempRoots(roots.splice(0))
  vi.unstubAllEnvs()
})

async function launcherForTest(): Promise<string | null> {
  const found = await resolveGitExecutable()
  if (!found) return null
  const top = /\\(?:mingw64|clangarm64|ucrt64|mingw32)\\bin\\git.exe$/i.test(found)
    ? win32.dirname(win32.dirname(win32.dirname(found)))
    : ['cmd', 'bin'].includes(win32.basename(win32.dirname(found)).toLowerCase())
      ? win32.dirname(win32.dirname(found))
      : null
  if (!top) return null
  const launcher = win32.join(top, 'cmd', 'git.exe')
  if (
    !(await access(launcher).then(
      () => true,
      () => false
    ))
  )
    return null
  const key = Object.keys(process.env).find((key) => key.toLowerCase() === 'path') ?? 'PATH'
  vi.stubEnv(key, `${win32.dirname(launcher)};${process.env[key] ?? ''}`)
  return launcher
}

it.runIf(process.platform === 'win32')(
  '런처와 production sh가 같은 환경을 본다 (AC3)',
  async (context) => {
    const launcher = await launcherForTest()
    if (!launcher) return context.skip('MSys2 Git for Windows cmd 런처가 없는 환경')
    expect((await gitCommand())?.file).not.toBe(launcher)
    const { root } = await createRepo(roots)
    const args = [
      '-c',
      'alias.orca-env=!printf "%s\\n" "$MSYSTEM" "$HOME" "$PLINK_PROTOCOL" "$PATH"; command -v sh',
      'orca-env'
    ]
    const expected = await execGit(launcher, args, { cwd: root, timeout: FIXTURE_GIT_TIMEOUT_MS })
    const actual = await runGit(root, args, { timeoutMs: FIXTURE_GIT_TIMEOUT_MS })
    expect(actual.ok).toBe(true)
    expect(actual.stdout).toBe(expected.stdout)
  }
)

it.runIf(process.platform === 'win32')(
  'production checkout commit-wip이 사용자 pre-commit 훅을 실행한다 (AC3)',
  async (context) => {
    if (!(await launcherForTest()))
      return context.skip('MSys2 Git for Windows cmd 런처가 없는 환경')
    const repo = await createRepo(roots, {
      commits: [{ message: 'base', files: { tracked: 'base\n' } }],
      branches: { feature: 0 }
    })
    await mkdir(join(repo.root, '.git', 'hooks'), { recursive: true })
    await writeFile(
      join(repo.root, '.git', 'hooks', 'pre-commit'),
      '#!/bin/sh\nprintf hook > .git/orca-hook\n',
      { mode: 0o755 }
    )
    await writeFile(join(repo.root, 'tracked'), 'dirty\n')
    expect(await gitCheckout(repo.root, 'feature', 'commit-wip')).toMatchObject({ ok: true })
    expect(await readFile(join(repo.root, '.git', 'orca-hook'), 'utf8')).toBe('hook')
  }
)
