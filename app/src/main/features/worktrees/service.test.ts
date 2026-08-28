import { execFile } from 'node:child_process'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { afterEach, describe, expect, it } from 'vitest'
import type { DbQueries } from '../../infra/db'
import { isWithinDir } from '../../infra/config/paths'
import { WorktreeService } from './service'

const exec = promisify(execFile)
const roots: string[] = []

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
})

async function repository(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'orca-worktree-test-'))
  roots.push(root)
  await exec('git', ['init', root])
  await exec('git', ['-C', root, 'config', 'user.email', 'test@orca.local'])
  await exec('git', ['-C', root, 'config', 'user.name', 'Orca Test'])
  await writeFile(join(root, 'README.md'), 'base\n')
  await exec('git', ['-C', root, 'add', 'README.md'])
  await exec('git', ['-C', root, 'commit', '-m', 'base'])
  return root
}

describe('WorktreeService', () => {
  it('clean HEAD에서 repository 밖 managed worktree를 만들고 metadata를 기록한다', async () => {
    const repo = await repository()
    const managed = await mkdtemp(join(tmpdir(), 'orca-managed-test-'))
    roots.push(managed)
    const rows: unknown[] = []
    const db = { insertManagedWorktree: (row: unknown) => rows.push(row) } as unknown as DbQueries
    const result = await new WorktreeService(db, managed).prepare({
      sourceCwd: repo,
      firstPrompt: 'fix auth redirect'
    })
    expect(result.kind).toBe('managed')
    expect(rows).toHaveLength(1)
    // Windows runner의 temp root 자체가 junction일 수 있다. 서비스가 `realpath()`한 뒤 DB에
    // 기록한 canonical worktree root를 경계로 써야 production identity와 같은 두 값을 비교한다.
    const recorded = rows[0] as { worktreeRoot: string }
    if (result.kind === 'managed')
      expect(isWithinDir(result.executionCwd, recorded.worktreeRoot)).toBe(true)
  })

  it('untracked 파일이 있으면 Git mutation 전에 거부한다', async () => {
    const repo = await repository()
    const managed = await mkdtemp(join(tmpdir(), 'orca-managed-test-'))
    roots.push(managed)
    await writeFile(join(repo, 'untracked.txt'), 'dirty')
    const rows: unknown[] = []
    const db = { insertManagedWorktree: (row: unknown) => rows.push(row) } as unknown as DbQueries
    const result = await new WorktreeService(db, managed).prepare({
      sourceCwd: repo,
      firstPrompt: 'work'
    })
    expect(result).toMatchObject({ kind: 'rejected', reason: 'dirty' })
    expect(rows).toEqual([])
  })

  it('managed worktree가 clean이고 새 commit이 없을 때만 안전 제거한다', async () => {
    const repo = await repository()
    const managed = await mkdtemp(join(tmpdir(), 'orca-managed-test-'))
    roots.push(managed)
    let row: Record<string, unknown> | undefined
    let deleted = false
    const db = {
      insertManagedWorktree: (value: Record<string, unknown>) => {
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
        deleted = true
      }
    } as unknown as DbQueries
    const service = new WorktreeService(db, managed)
    expect((await service.prepare({ sourceCwd: repo, firstPrompt: 'safe delete' })).kind).toBe(
      'managed'
    )
    expect(await service.removeForSession('s1')).toEqual({ ok: true })
    expect(deleted).toBe(true)
  })

  it('managed worktree가 dirty면 세션 작업을 보존한다', async () => {
    const repo = await repository()
    const managed = await mkdtemp(join(tmpdir(), 'orca-managed-test-'))
    roots.push(managed)
    let row: Record<string, unknown> | undefined
    let deleted = false
    const db = {
      insertManagedWorktree: (value: Record<string, unknown>) => {
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
        deleted = true
      }
    } as unknown as DbQueries
    const service = new WorktreeService(db, managed)
    const prepared = await service.prepare({ sourceCwd: repo, firstPrompt: 'preserve dirty' })
    expect(prepared.kind).toBe('managed')
    if (prepared.kind === 'managed')
      await writeFile(join(prepared.executionCwd, 'dirty.txt'), 'dirty')
    expect(await service.removeForSession('s1')).toMatchObject({
      ok: false,
      reason: 'worktree-dirty'
    })
    expect(deleted).toBe(false)
  })
})
