import { mkdir, mkdtemp, realpath, rm, symlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
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

    // 게이트는 **호출 전에** 만든다. `withRepoMutation` 은 콜백을 부르기 전에 `realpath` 로
    // 저장소 키를 canonical 화하고, 그 한 칸이 아래 대기보다 길면 콜백이 아직 돌지 않아
    // `release` 가 미할당인 채로 불린다 — 잠금이 아니라 픽스처가 무너지는 자리다(느린 러너
    // 에서 실측). 여기서 만들면 executor 가 동기라 `release` 는 첫 호출 전에 이미 있다.
    let release!: () => void
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    const first = withRepoMutation(repo, () => gate)
    let secondStarted = false
    const second = withRepoMutation(alias, async () => {
      secondStarted = true
    })
    // 음성 단언이라 늦어져도 뒤집히지 않는다 — 느려서 안 돈 것과 잠겨서 못 돈 것을 가르는
    // 것은 아래 `release()` 뒤의 양성 단언이다.
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
    // 양성 단언이라 고정 대기에 매달면 안 된다 — 두 `realpath` 가 10ms 를 넘기는 순간
    // "병렬로 시작한다" 가 아니라 "러너가 느리다" 를 보고한다. 직렬화되고 있었다면 게이트가
    // 아직 열리지 않아 `started` 는 1 에서 멈추므로, 기다려도 판정력은 그대로다.
    await vi.waitFor(() => expect(started).toBe(2), { timeout: 10_000, interval: 10 })
    release()
    await Promise.all(operations)
  })
})
