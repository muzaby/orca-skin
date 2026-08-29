// EP-12 — 같은 repo 를 바꾸는 **네 진입점**이 전부 repo mutation queue 를 지난다.
//
// queue 헬퍼 자체가 직렬화한다는 사실(`mutation-queue.test.ts`)은 진입 배선을 말하지 않는다 —
// 한 진입점이 `withRepoMutation` 을 우회해도 그 테스트는 초록이다. 여기서는 queue 를 잡아 둔
// 채 각 API 를 부르고 **git 부작용이 아직 일어나지 않았음**을 본다. 시간이 아니라 상태를
// 관측하므로 느린 러너에서도 판정이 뒤집히지 않는다.

import { execFile } from 'node:child_process'
import { access, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { afterEach, describe, expect, it } from 'vitest'
import { withRepoMutation } from './mutation-queue'
import { addWorktree, deleteBranch, listWorktrees, removeWorktree } from './worktree'
import { gitCheckout } from './git-cli'

const exec = promisify(execFile)
const roots: string[] = []
afterEach(async () =>
  Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
)

async function repository(): Promise<{ repo: string; head: string }> {
  const repo = await mkdtemp(join(tmpdir(), 'orca-queue-entry-'))
  roots.push(repo)
  await exec('git', ['init', repo])
  await exec('git', ['-C', repo, 'config', 'user.email', 'a@b.c'])
  await exec('git', ['-C', repo, 'config', 'user.name', 'orca'])
  await writeFile(join(repo, 'f.txt'), 'x\n')
  await exec('git', ['-C', repo, 'add', '.'])
  await exec('git', ['-C', repo, 'commit', '-m', 'init'])
  const { stdout } = await exec('git', ['-C', repo, 'rev-parse', 'HEAD'])
  return { repo, head: stdout.trim() }
}

const exists = (path: string): Promise<boolean> =>
  access(path).then(
    () => true,
    () => false
  )

const branches = async (repo: string): Promise<string> =>
  (await exec('git', ['-C', repo, 'branch', '--list'])).stdout

/** queue 를 잡은 채 `run()` 을 시작하고, 붙잡힌 동안 `observe()` 를 확인한 뒤 놓아준다. */
async function whileQueueHeld<T>(
  repo: string,
  run: () => Promise<T>,
  observe: () => Promise<void>
): Promise<T> {
  let release!: () => void
  const held = withRepoMutation(
    repo,
    () =>
      new Promise<void>((resolve) => {
        release = resolve
      })
  )
  const pending = run()
  await new Promise((resolve) => setTimeout(resolve, 150))
  await observe()
  release()
  const [result] = await Promise.all([pending, held])
  return result
}

describe('repo mutation 진입점은 전부 queue 를 지난다 (AC17 · EP-12)', () => {
  it('addWorktree', async () => {
    const { repo, head } = await repository()
    const target = join(repo, '..', `wt-${Date.now()}`)
    roots.push(target)

    const added = await whileQueueHeld(
      repo,
      () => addWorktree({ repoRoot: repo, path: target, branch: 'work/queued', base: head }),
      async () => expect(await exists(target)).toBe(false)
    )

    expect(added.ok).toBe(true)
    expect(await exists(target)).toBe(true)
  })

  it('removeWorktree', async () => {
    const { repo, head } = await repository()
    const target = join(repo, '..', `wt-rm-${Date.now()}`)
    roots.push(target)
    await addWorktree({ repoRoot: repo, path: target, branch: 'work/rm', base: head })

    await whileQueueHeld(
      repo,
      () => removeWorktree({ repoRoot: repo, path: target }),
      async () => expect((await listWorktrees(repo))?.length).toBe(2)
    )

    expect((await listWorktrees(repo))?.length).toBe(1)
  })

  it('deleteBranch', async () => {
    const { repo } = await repository()
    await exec('git', ['-C', repo, 'branch', 'work/doomed'])

    await whileQueueHeld(
      repo,
      () => deleteBranch({ repoRoot: repo, branch: 'work/doomed' }),
      async () => expect(await branches(repo)).toContain('work/doomed')
    )

    expect(await branches(repo)).not.toContain('work/doomed')
  })

  it('gitCheckout', async () => {
    const { repo } = await repository()
    await exec('git', ['-C', repo, 'branch', 'work/next'])
    const current = async (): Promise<string> =>
      (await exec('git', ['-C', repo, 'rev-parse', '--abbrev-ref', 'HEAD'])).stdout.trim()
    const before = await current()

    const result = await whileQueueHeld(
      repo,
      () => gitCheckout(repo, 'work/next'),
      async () => expect(await current()).toBe(before)
    )

    expect(result.ok).toBe(true)
    expect(await current()).toBe('work/next')
  })
})
