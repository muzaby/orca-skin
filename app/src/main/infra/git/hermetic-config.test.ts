// 격리 전역 git 설정 (0298) — 테스트 저장소는 저장소마다 `git config` 를 하지 않아도 신원·줄바꿈이
// 고정이고, `git commit` 이 `git maintenance run --auto` 자식 프로세스를 띄우지 않는다.
// 설정 내용의 정본은 `scripts/test-host.mjs` 의 `HERMETIC_GIT_CONFIG`, 기록은 `vitest-setup.mjs`.
import { mkdtemp, writeFile, readdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { HERMETIC_GIT_IDENTITY } from '../../../../scripts/test-host.mjs'
import { scaledBudget } from '../../../../scripts/test-time.mjs'
import { execGit, FIXTURE_GIT_TIMEOUT_MS, removeTempRoots } from './temp-repo.testfixture'

vi.setConfig(scaledBudget({ testTimeout: 60_000, hookTimeout: 60_000 }))
const roots: string[] = []
afterEach(() => removeTempRoots(roots.splice(0)))

async function git(
  cwd: string,
  args: string[],
  env: NodeJS.ProcessEnv = process.env
): Promise<{ stdout: string; stderr: string }> {
  return execGit('git', args, { cwd, env, timeout: FIXTURE_GIT_TIMEOUT_MS })
}

async function repo(): Promise<string> {
  const cwd = await mkdtemp(join(tmpdir(), 'orcinus-orca-hermetic-git-'))
  roots.push(cwd)
  const { stderr } = await git(cwd, ['init', '-q', '--initial-branch=main'])
  expect(stderr).toBe('')
  expect(
    (await readdir(join(cwd, '.git'), { recursive: true, withFileTypes: true }))
      .filter((entry) => entry.isFile())
      .map((entry) => entry.name)
      .sort()
  ).toEqual(['HEAD', 'config'])
  return cwd
}

describe('격리 전역 git 설정 (0298)', () => {
  it('새 저장소가 저장소별 설정 없이 고정 신원 · autocrlf=false · maintenance.auto=false 를 본다', async () => {
    const cwd = await repo()
    const get = async (key: string): Promise<string> =>
      (await git(cwd, ['config', '--get', key])).stdout.trim()
    expect(await get('user.name')).toBe(HERMETIC_GIT_IDENTITY.name)
    expect(await get('user.email')).toBe(HERMETIC_GIT_IDENTITY.email)
    expect(await get('core.autocrlf')).toBe('false')
    expect(await get('maintenance.auto')).toBe('false')
    expect(await get('init.templateDir')).toBe('')
    expect(await get('core.fsync')).toBe('none')
  })

  it('commit 이 고정 신원으로 기록되고 git maintenance 자식을 띄우지 않는다', async () => {
    const cwd = await repo()
    await writeFile(join(cwd, 'a.txt'), 'a\n')
    await git(cwd, ['add', 'a.txt'])
    const { stderr } = await git(cwd, ['commit', '-q', '-m', 'a'], {
      ...process.env,
      GIT_TRACE: '1'
    })
    // 추적이 실제로 켜졌다 — 꺼져 있으면 아래 부재 단언은 아무것도 보지 않는다.
    expect(stderr).toMatch(/trace: built-in: git commit/)
    expect(stderr).not.toMatch(/maintenance/)
    const author = (await git(cwd, ['log', '-1', '--format=%an <%ae>'])).stdout.trim()
    expect(author).toBe(`${HERMETIC_GIT_IDENTITY.name} <${HERMETIC_GIT_IDENTITY.email}>`)
  })
})
