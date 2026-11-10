// 부모 io-git-guard.test.ts가 실제 vitest 훅 실패를 관측하는 고장 입력이다.
// 일반 include(*.test.ts)에서는 수집하지 않고 부모가 만든 io 프로젝트에서만 실행한다.
import { afterAll, it } from 'vitest'
import { IO_GIT_ALLOWED } from '../../../scripts/test-pools.mjs'
import { execGit, FIXTURE_GIT_TIMEOUT_MS } from './git/temp-repo.testfixture'

const trip = (): Promise<unknown> =>
  execGit('git', ['init', '--initial-branch=main'], {
    cwd: process.env.ORCINUS_ORCA_GIT_GUARD_PROBE_CWD!,
    timeout: FIXTURE_GIT_TIMEOUT_MS
  })
it('직접 구성 고장 입력', async () => {
  if (process.env.ORCINUS_ORCA_GIT_GUARD_PROBE_MODE === 'allowance')
    IO_GIT_ALLOWED.push({
      file: 'src/main/infra/io-git-guard.probe.testfixture.ts',
      subcommand: 'init',
      count: 1,
      reason: '이 자식에서만 쓰는 고장 입력: 실제 0회와 허용 1회의 불일치'
    })
  if (process.env.ORCINUS_ORCA_GIT_GUARD_PROBE_MODE === 'test') await trip()
})
afterAll(async () => {
  if (process.env.ORCINUS_ORCA_GIT_GUARD_PROBE_MODE === 'afterAll') await trip()
})
