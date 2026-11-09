import { execFileSync } from 'node:child_process'
import { afterEach, expect, it, vi } from 'vitest'
import {
  IO_GUARD,
  drainGuardViolations,
  type IoGitGuardState
} from '../../../scripts/test-pools.mjs'
import { scaledBudget } from '../../../scripts/test-time.mjs'
import {
  createRepo,
  execGit,
  removeTempRoots,
  FIXTURE_GIT_TIMEOUT_MS
} from './git/temp-repo.testfixture'
import { gitCommand } from './git/git-executable'
import * as commands from './git/git-executable'
import { runGit } from './git/runner'
import { gitCheckout } from './git/git-cli'
import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { pathToFileURL } from 'node:url'
import { join } from 'node:path'

vi.setConfig(scaledBudget({ testTimeout: 90_000, hookTimeout: 90_000 }))
const roots: string[] = []
afterEach(async () => {
  vi.restoreAllMocks()
  await removeTempRoots(roots.splice(0))
})
const state = (): IoGitGuardState =>
  (process as unknown as Record<symbol, IoGitGuardState>)[IO_GUARD]

it('픽스처 git 은 해석된 실행 파일로 뜬다', async () => {
  const command = (await gitCommand())!
  const env = vi.fn(async (base: NodeJS.ProcessEnv) => ({
    ...(await command.env(base)),
    ORCA_GIT_PROBE: 'resolved-env'
  }))
  vi.spyOn(commands, 'gitCommand').mockResolvedValue({ file: command.file, env })
  const { stdout } = await execGit(
    'git',
    ['-c', 'alias.orca-probe=!printf "%s" "$ORCA_GIT_PROBE"', 'orca-probe'],
    { timeout: FIXTURE_GIT_TIMEOUT_MS }
  )
  expect(stdout).toBe('resolved-env')
  expect(env).toHaveBeenCalledWith(process.env)
  expect(state()).toBeDefined()
  expect(state().spawns.at(-1)).toMatchObject({ file: command.file, kind: 'pass' })
  expect(state().violations).toEqual([])
})

it.each(['test', 'afterAll', 'allowance'] as const)(
  '실제 vitest의 %s 위반이 red가 된다',
  async (mode) => {
    const root = await mkdtemp(join(tmpdir(), 'orca-git-guard-probe-'))
    roots.push(root)
    const app = process.cwd()
    const config = join(root, 'vitest.config.mjs')
    const report = join(root, 'report.json')
    const file = 'src/main/infra/io-git-guard.probe.testfixture.ts'
    await writeFile(
      config,
      `
import { buildProjects } from ${JSON.stringify(pathToFileURL(join(app, 'scripts/test-pools.mjs')).href)}
import { scaledBudget } from ${JSON.stringify(pathToFileURL(join(app, 'scripts/test-time.mjs')).href)}
export default { root: ${JSON.stringify(app)}, test: { projects: buildProjects({
  io: [${JSON.stringify(file)}], exclude: [], base: {
    environment: 'node', setupFiles: [${JSON.stringify(join(app, 'scripts/vitest-setup.mjs'))}],
    ...scaledBudget({ testTimeout: 20_000, hookTimeout: 20_000 })
  }
}).filter(project => project.test.name === 'io') } }
`
    )
    const args = [
      join(app, 'node_modules/vitest/vitest.mjs'),
      'run',
      '--config',
      config,
      '--reporter=json',
      '--outputFile',
      report
    ]
    const ok = await execGit(process.execPath, args, {
      cwd: app,
      timeout: FIXTURE_GIT_TIMEOUT_MS,
      env: { ...process.env, ORCA_GIT_GUARD_PROBE_CWD: root, ORCA_GIT_GUARD_PROBE_MODE: mode }
    }).then(
      () => true,
      () => false
    )
    const result = JSON.parse(await readFile(report, 'utf8'))
    expect(ok).toBe(false)
    expect(result.success).toBe(false)
    expect(result.numFailedTests).toBe(mode === 'test' ? 1 : 0)
    expect(JSON.stringify(result)).toContain('[test-git]')
  }
)

it('직접 runGit 구성은 기록되고 빌더·production commit-wip은 통과한다', async () => {
  const repo = await createRepo(roots, {
    commits: [{ message: 'base', files: { tracked: 'base\n' } }],
    branches: { feature: 0 }
  })
  expect(state().violations).toEqual([])
  expect(
    state()
      .spawns.filter((spawn) => ['init', 'fast-import'].includes(spawn.args[0]))
      .map((spawn) => spawn.kind)
  ).toEqual(['pass', 'pass'])
  await runGit(repo.root, ['init'], { timeoutMs: FIXTURE_GIT_TIMEOUT_MS })
  expect(drainGuardViolations(state())?.message).toContain('[test-git] init')
  await writeFile(join(repo.root, 'tracked'), 'dirty\n')
  expect(await gitCheckout(repo.root, 'feature', 'commit-wip')).toMatchObject({ ok: true })
  expect(state().violations).toEqual([])
  expect(state().spawns.find((spawn) => spawn.args[0] === 'commit')).toMatchObject({ kind: 'pass' })
})

it('이름 실행은 비동기·동기 모두 위반을 기록한다', async () => {
  await new Promise<void>((resolve) => {
    // 감시기의 고장 입력: 픽스처의 이름 해석을 의도적으로 우회한다.
    import('node:child_process').then(({ execFile }) =>
      execFile('git', ['--version'], () => resolve())
    )
  })
  expect(drainGuardViolations(state())?.message).toContain('[test-git]')
  execFileSync('git', ['--version'])
  expect(drainGuardViolations(state())?.message).toContain('[test-git]')
})
