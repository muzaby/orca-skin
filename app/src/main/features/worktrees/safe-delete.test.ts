// AC15 · VP-07 — 세션 삭제는 **clean + HEAD == base** 일 때만 자동 제거하고 나머지는 전부 보존한다.
//
// `service.test.ts` 가 네 상태 중 둘(clean·dirty)을 갖는다. 여기는 나머지 둘(새 commit·검사 실패)과
// **호출 순서·횟수**를 본다 — 순서가 뒤집히면 "보존" 판정 전에 Git 이 먼저 지워지고, 그 상태는
// 결과값이 `ok:false` 여도 사용자 작업이 이미 사라진 뒤다.
//
// AC16 · VP-16 — porcelain 목록에 외부 worktree 가 섞여 있어도 remove 대상은 managed row 뿐이다.
// 분류가 목록 순서나 개수에 기대면 외부 작업이 지워진다.

import { execFile } from 'node:child_process'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { DbQueries } from '../../infra/db'
import { addWorktree, deleteBranch, listWorktrees, removeWorktree } from '../../infra/git/worktree'
import { WorktreeService } from './service'

const exec = promisify(execFile)
const roots: string[] = []
afterEach(async () =>
  Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
)

async function repository(): Promise<string> {
  const repo = await mkdtemp(join(tmpdir(), 'orca-safe-delete-'))
  roots.push(repo)
  await exec('git', ['init', repo])
  await exec('git', ['-C', repo, 'config', 'user.email', 'a@b.c'])
  await exec('git', ['-C', repo, 'config', 'user.name', 'orca'])
  await writeFile(join(repo, 'f.txt'), 'x\n')
  await exec('git', ['-C', repo, 'add', '.'])
  await exec('git', ['-C', repo, 'commit', '-m', 'init'])
  return repo
}

type Row = Record<string, unknown>

/** 실제 prepare 로 managed row 를 만들고, 그 뒤 호출 순서를 기록하는 서비스를 돌려준다. */
async function managedSession(repo: string): Promise<{
  service: WorktreeService
  row: () => Row
  order: string[]
  managed: string
}> {
  const managed = await mkdtemp(join(tmpdir(), 'orca-safe-managed-'))
  roots.push(managed)
  let row!: Row
  const order: string[] = []
  const db = {
    insertManagedWorktree: (value: Row) => {
      row = {
        id: value.id,
        session_id: 's1',
        repo_root: value.repoRoot,
        source_cwd: value.sourceCwd,
        worktree_root: value.worktreeRoot,
        branch: value.branch,
        base_oid: value.baseOid,
        created_at: value.createdAt
      }
    },
    getManagedWorktreeBySession: () => row,
    deleteManagedWorktree: () => {
      order.push('db.delete')
    }
  } as unknown as DbQueries
  const service = new WorktreeService(db, managed, {
    add: addWorktree,
    list: listWorktrees,
    remove: async (input) => {
      order.push(`remove:${input.path}`)
      return removeWorktree(input)
    },
    deleteBranch: async (input) => {
      order.push('branch.delete')
      return deleteBranch(input)
    }
  })
  const prepared = await service.prepare({ sourceCwd: repo, firstPrompt: 'safe delete' })
  expect(prepared.kind).toBe('managed')
  order.length = 0
  return { service, row: () => row, order, managed }
}

describe('WorktreeService.removeForSession — 네 상태와 호출 순서 (AC15)', () => {
  it('clean + HEAD == base 면 remove → branch delete → db delete 순으로 각각 1회다', async () => {
    const repo = await repository()
    const { service, row, order } = await managedSession(repo)

    expect(await service.removeForSession('s1')).toEqual({ ok: true })

    expect(order).toEqual([`remove:${row().worktree_root as string}`, 'branch.delete', 'db.delete'])
  })

  it('worktree에 새 commit이 있으면 아무것도 지우지 않는다', async () => {
    const repo = await repository()
    const { service, row, order } = await managedSession(repo)
    const wt = row().worktree_root as string
    await writeFile(join(wt, 'new.txt'), 'work\n')
    await exec('git', ['-C', wt, 'add', '.'])
    await exec('git', ['-C', wt, 'commit', '-m', 'user work'])

    expect(await service.removeForSession('s1')).toMatchObject({
      ok: false,
      reason: 'worktree-has-commits'
    })

    // 판정이 Git mutation 보다 앞이라는 관측 — 순서가 뒤집혔으면 여기 항목이 남는다.
    expect(order).toEqual([])
    expect((await listWorktrees(repo))?.length).toBe(2)
  })

  it('Git 검사 자체가 실패하면 보존한다 — 실패를 clean으로 읽지 않는다', async () => {
    const repo = await repository()
    const { service, row, order } = await managedSession(repo)
    // worktree 디렉터리를 통째로 없앤다 — `git status` 가 답을 못 준다.
    await rm(row().worktree_root as string, { recursive: true, force: true })

    expect(await service.removeForSession('s1')).toMatchObject({
      ok: false,
      reason: 'worktree-check-failed'
    })
    expect(order).toEqual([])
  })

  it('dirty면 보존하고, 그 판정도 Git mutation 앞이다', async () => {
    const repo = await repository()
    const { service, row, order } = await managedSession(repo)
    await writeFile(join(row().worktree_root as string, 'draft.txt'), 'wip\n')

    expect(await service.removeForSession('s1')).toMatchObject({
      ok: false,
      reason: 'worktree-dirty'
    })
    expect(order).toEqual([])
  })

  it('검사가 답을 못 주면(null) 각각 보존한다 — clean·HEAD 두 축을 따로 본다', async () => {
    // 위 케이스는 디렉터리를 지워 두 검사가 함께 실패한다. 그러면 `isClean` 이 null 을 true 로
    // 읽어도 `resolveHead` 가 대신 막아 판정이 같아진다 — 두 축을 갈라야 각각이 잠긴다.
    const repo = await repository()
    const { service, order } = await managedSession(repo)
    const repository_ = await import('../../infra/git/repository')

    const cleanSpy = vi.spyOn(repository_, 'isClean').mockResolvedValue(null)
    expect(await service.removeForSession('s1')).toMatchObject({
      ok: false,
      reason: 'worktree-check-failed'
    })
    expect(order).toEqual([])

    cleanSpy.mockResolvedValue(true)
    const headSpy = vi.spyOn(repository_, 'resolveHead').mockResolvedValue(null)
    expect(await service.removeForSession('s1')).toMatchObject({
      ok: false,
      reason: 'worktree-check-failed'
    })
    expect(order).toEqual([])

    cleanSpy.mockRestore()
    headSpy.mockRestore()
  })

  it('managed row가 없는 세션은 통과시킨다 — 기존 삭제 경로', async () => {
    const managed = await mkdtemp(join(tmpdir(), 'orca-safe-managed-'))
    roots.push(managed)
    const db = { getManagedWorktreeBySession: () => undefined } as unknown as DbQueries

    expect(await new WorktreeService(db, managed).removeForSession('unknown')).toEqual({ ok: true })
  })
})

describe('외부 worktree 는 자동 mutation 대상이 아니다 (AC16 · VP-16)', () => {
  it('porcelain 목록에 외부가 섞여도 remove 대상은 managed row 하나뿐이다', async () => {
    const repo = await repository()
    const { service, row, order } = await managedSession(repo)

    // 앱 밖에서 만든 worktree — Orca 의 managed root 밖이고 DB row 도 없다.
    const external = join(await mkdtemp(join(tmpdir(), 'orca-external-')), 'wt')
    roots.push(external)
    const head = (await exec('git', ['-C', repo, 'rev-parse', 'HEAD'])).stdout.trim()
    expect(
      (await addWorktree({ repoRoot: repo, path: external, branch: 'user/own', base: head })).ok
    ).toBe(true)
    const before = await listWorktrees(repo)
    expect(before?.length).toBe(3) // main + managed + external

    expect(await service.removeForSession('s1')).toEqual({ ok: true })

    // 대상은 managed 경로 하나 — 목록 순서나 개수로 고르지 않는다.
    expect(order.filter((step) => step.startsWith('remove:'))).toEqual([
      `remove:${row().worktree_root as string}`
    ])
    const after = await listWorktrees(repo)
    expect(after?.map((entry) => entry.path)).toContain(
      before!.find((entry) => entry.path.includes('orca-external-'))!.path
    )
    expect(after?.length).toBe(2)
  })
})
