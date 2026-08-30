// 0211 VP-01 · VP-02 · VP-03 — 준비 단계의 **순서와 자리**.
//
// 이 불변식은 "다섯 단계가 이 순서로 정확히 1회씩" 이라 자리를 말한다. 존재만 단언하면
// 두 발신 지점을 맞바꾼 회귀가 다섯 문자열을 그대로 담은 채 통과한다 — 그래서 배열 전체를
// `toEqual` 로 본다(plan §5 방향 규칙, VP-01 등록 변이 `base`↔`branch`).
//
// **컴포지션 루트에 둔다** — 단계 발신은 `features/worktrees` 와 `app/chat-turn` 두
// 레이어의 합성이라 feature 안에 두면 `boundaries/dependencies` 가 features→app 을
// 막는다(`worktree-bind.test.ts` 와 같은 이유·같은 자리).
//
// git operations 만 fake 다. `onProgress` 호출부는 **프로덕션 코드 그대로** 지나므로 이
// 배열이 AT-01 의 분모(5)를 실제로 센다.

import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, describe, expect, it, vi } from 'vitest'
import type { WorktreePrepareStep } from '../../../shared/ipc'
import { runGit } from '../../infra/git/runner'
import { prepareTurnWorktree } from './prepare-worktree'
import { WorktreeService } from '../../features/worktrees/service'

const dirs: string[] = []
afterAll(async () => {
  await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
})

async function git(cwd: string, args: string[]): Promise<void> {
  const result = await runGit(cwd, args)
  if (!result.ok) throw new Error(`git ${args.join(' ')} → ${result.stderr}`)
}

async function makeRepo(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'orca-steps-'))
  dirs.push(dir)
  await git(dir, ['init', '--initial-branch=main'])
  await git(dir, ['config', 'user.email', 't@orca.local'])
  await git(dir, ['config', 'user.name', 'orca test'])
  await writeFile(join(dir, 'a.ts'), 'x\n')
  await git(dir, ['add', '.'])
  await git(dir, ['commit', '-m', 'base'])
  return dir
}

// DB 는 insert 만 쓴다 — 이 pair 는 단계 발신을 보지 영속을 보지 않는다.
function fakeDb(): { insertManagedWorktree: ReturnType<typeof vi.fn> } {
  return { insertManagedWorktree: vi.fn() }
}

function fakeOps(): {
  add: ReturnType<typeof vi.fn>
  remove: ReturnType<typeof vi.fn>
  list: ReturnType<typeof vi.fn>
  deleteBranch: ReturnType<typeof vi.fn>
} {
  return {
    add: vi.fn(async () => ({ ok: true as const })),
    remove: vi.fn(async () => ({ ok: true as const })),
    list: vi.fn(async () => []),
    deleteBranch: vi.fn(async () => ({ ok: true as const }))
  }
}

describe('격리 준비 단계 (VP-01)', () => {
  it('다섯 단계가 이 순서로 정확히 1회씩 온다', async () => {
    const repo = await makeRepo()
    const root = await mkdtemp(join(tmpdir(), 'orca-wt-'))
    dirs.push(root)
    const ops = fakeOps()
    // `worktree add` fake 는 디렉토리를 만들지 않으므로 실제 add 로 대체한다 — 성공 경로의
    // 마지막 단계(`session`)까지 가려면 실행 cwd 가 실재해야 한다.
    ops.add.mockImplementation(async ({ path, branch, base }) => {
      await git(repo, ['worktree', 'add', '-b', branch, path, base])
      return { ok: true as const }
    })
    const service = new WorktreeService(fakeDb() as never, root, ops as never)
    const steps: WorktreePrepareStep[] = []

    const result = await prepareTurnWorktree({
      enabled: true,
      sourceCwd: repo,
      firstPrompt: 'work',
      signal: new AbortController().signal,
      adapter: { complete: vi.fn(async () => 'list-filter') },
      providerSettings: undefined as never,
      env: {},
      worktrees: service,
      onProgress: (step) => steps.push(step)
    })

    expect(result.kind).toBe('managed')
    expect(steps).toEqual(['repo', 'base', 'branch', 'worktree', 'session'])
  })

  it('저장소가 아니면 repo 단계 뒤에 멈춘다 — 실패 뒤에 "세션 시작" 을 말하지 않는다', async () => {
    const outside = await mkdtemp(join(tmpdir(), 'orca-nonrepo-'))
    dirs.push(outside)
    const root = await mkdtemp(join(tmpdir(), 'orca-wt-'))
    dirs.push(root)
    const service = new WorktreeService(fakeDb() as never, root, fakeOps() as never)
    const steps: WorktreePrepareStep[] = []

    const result = await prepareTurnWorktree({
      enabled: true,
      sourceCwd: outside,
      firstPrompt: 'work',
      signal: new AbortController().signal,
      adapter: { complete: vi.fn() },
      providerSettings: undefined as never,
      env: {},
      worktrees: service,
      onProgress: (step) => steps.push(step)
    })

    expect(result.kind).toBe('rejected')
    expect(steps).toEqual(['repo'])
    expect(steps).not.toContain('session')
  })
})

describe('비격리·resume 은 단계를 내지 않는다 (VP-03 · D-005)', () => {
  it('격리 off 신규 세션에서 발신 0건', async () => {
    const steps: WorktreePrepareStep[] = []
    const result = await prepareTurnWorktree({
      enabled: false,
      sourceCwd: '/repo',
      firstPrompt: 'work',
      signal: new AbortController().signal,
      adapter: { complete: vi.fn() },
      providerSettings: undefined as never,
      env: {},
      worktrees: { prepare: vi.fn(), recoverMissingWorktree: vi.fn() } as never,
      onProgress: (step) => steps.push(step)
    })
    expect(result.kind).toBe('passthrough')
    expect(steps).toEqual([])
  })

  it('resume 세션에서 발신 0건 — 준비 경로를 지나지 않는다', async () => {
    const steps: WorktreePrepareStep[] = []
    await prepareTurnWorktree({
      enabled: true,
      sessionId: 'session-1',
      sourceCwd: '/repo',
      firstPrompt: 'work',
      signal: new AbortController().signal,
      adapter: { complete: vi.fn() },
      providerSettings: undefined as never,
      env: {},
      worktrees: {
        prepare: vi.fn(),
        recoverMissingWorktree: vi.fn(async () => ({ kind: 'none' as const }))
      } as never,
      onProgress: (step) => steps.push(step)
    })
    expect(steps).toEqual([])
  })
})

describe('표시 정본이 준비 결과에 실린다 (VP-04 의 producer 절)', () => {
  it('managed 결과가 source_cwd·repo_root 를 함께 준다 — 소비자가 역산하지 않는다', async () => {
    const repo = await makeRepo()
    const root = await mkdtemp(join(tmpdir(), 'orca-wt-'))
    dirs.push(root)
    const ops = fakeOps()
    ops.add.mockImplementation(async ({ path, branch, base }) => {
      await git(repo, ['worktree', 'add', '-b', branch, path, base])
      return { ok: true as const }
    })
    const service = new WorktreeService(fakeDb() as never, root, ops as never)
    const onManaged = vi.fn()

    const result = await prepareTurnWorktree({
      enabled: true,
      sourceCwd: repo,
      firstPrompt: 'work',
      signal: new AbortController().signal,
      adapter: { complete: vi.fn(async () => 'x') },
      providerSettings: undefined as never,
      env: {},
      worktrees: service,
      onManaged
    })

    expect(result.kind).toBe('managed')
    const display = onManaged.mock.calls[0][0]
    // 실행 경로와 **다른 값**이어야 한다 — 같으면 표시가 아무것도 고치지 않는다.
    expect(display.sourceCwd).not.toBe((result as { executionCwd: string }).executionCwd)
    expect(display.repoRoot).toBe(display.sourceCwd)
  })
})
