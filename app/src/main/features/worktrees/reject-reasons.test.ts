// AC14 · VP-02 — Git 없음 · non-repo · dirty 는 **그 send 의 오류**이고 앱 전체 실패가 아니다.
//
// `service.test.ts` 가 dirty 하나를 갖는다. 여기는 나머지 두 이유와, 그 실패가 **다음 호출을
// 오염시키지 않는다**는 것을 본다 — 준비가 실패한 뒤 서비스가 내부 상태를 남기면 다음 세션이
// 같은 이유로 계속 거부된다.

import { execFile } from 'node:child_process'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { DbQueries } from '../../infra/db'
import * as repository from '../../infra/git/repository'
import { WorktreeService } from './service'

const exec = promisify(execFile)
const roots: string[] = []
afterEach(async () => {
  vi.restoreAllMocks()
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
})

async function repo(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'orca-reject-repo-'))
  roots.push(dir)
  await exec('git', ['init', dir])
  await exec('git', ['-C', dir, 'config', 'user.email', 'a@b.c'])
  await exec('git', ['-C', dir, 'config', 'user.name', 'orca'])
  await writeFile(join(dir, 'f.txt'), 'x\n')
  await exec('git', ['-C', dir, 'add', '.'])
  await exec('git', ['-C', dir, 'commit', '-m', 'init'])
  return dir
}

async function service(): Promise<{ svc: WorktreeService; rows: unknown[] }> {
  const managed = await mkdtemp(join(tmpdir(), 'orca-reject-managed-'))
  roots.push(managed)
  const rows: unknown[] = []
  const db = { insertManagedWorktree: (row: unknown) => rows.push(row) } as unknown as DbQueries
  return { svc: new WorktreeService(db, managed), rows }
}

describe('준비 거부 이유는 send 단위다 (AC14 · VP-02)', () => {
  it('저장소가 아니면 `not-repo` 로 거부하고 Git mutation 을 0회 한다', async () => {
    const plain = await mkdtemp(join(tmpdir(), 'orca-not-a-repo-'))
    roots.push(plain)
    const { svc, rows } = await service()

    expect(await svc.prepare({ sourceCwd: plain, firstPrompt: 'work' })).toMatchObject({
      kind: 'rejected',
      reason: 'not-repo'
    })
    expect(rows).toEqual([])
  })

  // 0210: 준비 단계의 dirty 게이트가 사라져 이 이유의 producer 도 옮겨갔다. **두 원인은 여전히
  // 갈라져야 한다** — git 이 없어서 root 를 못 읽은 것을 "저장소가 아닙니다" 로 말하면 사용자가
  // 엉뚱한 곳을 고친다.
  it('Git 이 답을 못 주면 `git-unavailable` 이다 — `not-repo` 로 읽지 않는다', async () => {
    const dir = await repo()
    const { svc, rows } = await service()
    // runner ENOENT·권한 거부 등으로 git 실행 자체가 실패하는 상태.
    vi.spyOn(repository, 'resolveRepoRoot').mockResolvedValue(null)
    vi.spyOn(repository, 'gitAvailable').mockResolvedValue(false)

    expect(await svc.prepare({ sourceCwd: dir, firstPrompt: 'work' })).toMatchObject({
      kind: 'rejected',
      reason: 'git-unavailable'
    })
    expect(rows).toEqual([])
  })

  it('git 은 도는데 저장소가 아니면 `not-repo` 다 — 두 이유가 같은 분기에서 갈린다', async () => {
    const plain = await mkdtemp(join(tmpdir(), 'orca-not-a-repo-'))
    roots.push(plain)
    const { svc } = await service()
    vi.spyOn(repository, 'gitAvailable').mockResolvedValue(true)

    expect(await svc.prepare({ sourceCwd: plain, firstPrompt: 'work' })).toMatchObject({
      kind: 'rejected',
      reason: 'not-repo'
    })
  })

  it('저장소 밖 하위 경로는 `invalid-path` 다', async () => {
    const outside = await mkdtemp(join(tmpdir(), 'orca-outside-'))
    roots.push(outside)
    const { svc } = await service()
    vi.spyOn(repository, 'resolveRepoRoot').mockResolvedValue(join(outside, 'elsewhere'))

    expect(await svc.prepare({ sourceCwd: outside, firstPrompt: 'work' })).toMatchObject({
      kind: 'rejected',
      reason: 'invalid-path'
    })
  })

  it('거부한 뒤에도 다음 준비는 성공한다 — 실패가 서비스에 남지 않는다', async () => {
    const plain = await mkdtemp(join(tmpdir(), 'orca-not-a-repo-'))
    roots.push(plain)
    const dir = await repo()
    const { svc, rows } = await service()

    expect((await svc.prepare({ sourceCwd: plain, firstPrompt: 'first' })).kind).toBe('rejected')
    expect((await svc.prepare({ sourceCwd: dir, firstPrompt: 'second' })).kind).toBe('managed')
    expect(rows).toHaveLength(1)
  })
})
