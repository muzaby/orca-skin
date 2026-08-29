import { mkdir, mkdtemp, realpath, rm, symlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { canonicalRepoKey, withRepoMutation } from './mutation-queue'

const roots: string[] = []
afterEach(async () =>
  Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
)

describe('repository mutation queue', () => {
  it('serializes filesystem aliases of the same repository', async () => {
    const root = await mkdtemp(join(tmpdir(), 'orca-queue-test-'))
    roots.push(root)
    const repo = join(root, 'repo')
    const alias = join(root, 'alias')
    await mkdir(repo)
    await symlink(repo, alias, process.platform === 'win32' ? 'junction' : 'dir')
    expect(await canonicalRepoKey(alias)).toBe(await realpath(repo))

    let release!: () => void
    const first = withRepoMutation(
      repo,
      () =>
        new Promise<void>((resolve) => {
          release = resolve
        })
    )
    let secondStarted = false
    const second = withRepoMutation(alias, async () => {
      secondStarted = true
    })
    await new Promise((resolve) => setTimeout(resolve, 10))
    expect(secondStarted).toBe(false)
    release()
    await Promise.all([first, second])
    expect(secondStarted).toBe(true)
  })

  it('allows different repositories to start in parallel', async () => {
    const root = await mkdtemp(join(tmpdir(), 'orca-queue-test-'))
    roots.push(root)
    const one = join(root, 'one')
    const two = join(root, 'two')
    await Promise.all([mkdir(one), mkdir(two)])
    let started = 0
    let release!: () => void
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    const operations = [one, two].map((repo) =>
      withRepoMutation(repo, async () => {
        started += 1
        await gate
      })
    )
    await new Promise((resolve) => setTimeout(resolve, 10))
    expect(started).toBe(2)
    release()
    await Promise.all(operations)
  })
})
