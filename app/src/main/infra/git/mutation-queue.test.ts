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

    // **획득을 시간이 아니라 사실로 기다린다** (`queue-entry.test.ts` 와 같은 형태, 0218 I-05).
    // `withRepoMutation` 은 큐 슬롯을 잡기 **전에** `canonicalRepoKey`(realpath)를 await 한다.
    // 두 호출을 연달아 띄우면 둘은 realpath 완료 순서를 두고 경쟁하고, alias 쪽이 먼저 끝나면
    // 그쪽이 슬롯을 잡아 즉시 실행된다 — "먼저 띄운 쪽이 이겼겠지" 를 고정 대기로 가정하면
    // 부하가 걸린 병렬 실행에서 그대로 뒤집힌다(실측).
    let release!: () => void
    let acquired!: () => void
    const acquisition = new Promise<void>((resolve) => {
      acquired = resolve
    })
    const first = withRepoMutation(repo, () => {
      acquired()
      return new Promise<void>((resolve) => {
        release = resolve
      })
    })
    // 여기를 지나면 tail 이 이미 등록돼 있어 alias 쪽은 반드시 뒤에 줄 선다.
    await acquisition
    let secondStarted = false
    const second = withRepoMutation(alias, async () => {
      secondStarted = true
    })
    // 잠금이 성립하면 이 창에서 아무것도 일어나지 않는다. 늦어서 안 돈 것과 잠겨서 못 돈 것을
    // 가르는 것은 아래 `release()` 뒤의 양성 단언이다.
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
