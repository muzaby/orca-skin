import { execFile } from 'node:child_process'
import { mkdir, mkdtemp, realpath, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, join, relative, sep } from 'node:path'
import { promisify } from 'node:util'
import { afterEach, describe, expect, it } from 'vitest'
import type { DbQueries } from '../../infra/db'
import { isWithinDir } from '../../infra/config/paths'
import { WorktreeService } from './service'
import { addWorktree, deleteBranch, listWorktrees, removeWorktree } from '../../infra/git/worktree'

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

  // 0210 D-104 가 0209 D-007(UUID 세그먼트)을 대체한다. 첫 칸은 **저장소를 식별**해야 하고
  // 둘째 칸은 브랜치와 **일치**해야 한다 — 무작위 UUID 두 겹은 둘 다 못 한다.
  // 저장소 2개 + 준비 3회라 Windows 러너에서 기본 5초를 넘는다(실측 5.0s 초과).
  it('managed 경로는 <repo>-<hash8>/<브랜치> 2단이고 같은 repo 는 늘 같은 첫 칸이다 (AC5 · AC6)', async () => {
    const repo = await repository()
    const other = await repository()
    const managed = await mkdtemp(join(tmpdir(), 'orca-managed-seg-'))
    roots.push(managed)
    const rows: Array<{ worktreeRoot: string; branch: string }> = []
    const db = {
      insertManagedWorktree: (row: { worktreeRoot: string; branch: string }) => rows.push(row)
    } as unknown as DbQueries
    const service = new WorktreeService(db, managed)

    await service.prepare({ sourceCwd: repo, firstPrompt: 'fix auth redirect' })
    await service.prepare({ sourceCwd: repo, firstPrompt: 'second task' })
    await service.prepare({ sourceCwd: other, firstPrompt: 'elsewhere' })

    const canonicalManaged = await realpath(managed)
    const segmentsOf = (row: { worktreeRoot: string }): string[] =>
      relative(canonicalManaged, row.worktreeRoot).split(sep)
    expect(rows).toHaveLength(3)
    for (const row of rows) expect(segmentsOf(row)).toHaveLength(2)

    // **결정성** — 같은 저장소의 두 준비가 같은 첫 칸을 쓴다. `randomUUID()` 로 되돌리면 red.
    expect(segmentsOf(rows[0])[0]).toBe(segmentsOf(rows[1])[0])
    // 다른 저장소는 다른 첫 칸이다 — 이름이 같아도 경로 해시가 가른다.
    expect(segmentsOf(rows[2])[0]).not.toBe(segmentsOf(rows[0])[0])
    // 첫 칸이 저장소를 사람에게 말해준다.
    expect(segmentsOf(rows[0])[0]).toMatch(
      new RegExp(`^${basename(repo).replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')}-[0-9a-f]{8}$`)
    )
    // 둘째 칸은 실제로 만들어진 브랜치에서 파생된다 — 두 준비의 브랜치가 다르면 칸도 다르다.
    for (const row of rows) expect(segmentsOf(row)[1]).toBe(row.branch.replace(/\//g, '-'))
    expect(segmentsOf(rows[0])[1]).not.toBe(segmentsOf(rows[1])[1])
  }, 30_000)

  it('repository 하위 cwd를 managed worktree 안의 같은 subpath로 보존한다', async () => {
    const repo = await repository()
    const sourceCwd = join(repo, 'packages', 'web')
    await mkdir(sourceCwd, { recursive: true })
    await writeFile(join(sourceCwd, 'index.ts'), 'export {}\n')
    await exec('git', ['-C', repo, 'add', '.'])
    await exec('git', ['-C', repo, 'commit', '-m', 'nested'])
    const managed = await mkdtemp(join(tmpdir(), 'orca-managed-test-'))
    roots.push(managed)
    const rows: Array<{ worktreeRoot: string }> = []
    const db = {
      insertManagedWorktree: (row: { worktreeRoot: string }) => rows.push(row)
    } as unknown as DbQueries

    const result = await new WorktreeService(db, managed).prepare({
      sourceCwd,
      firstPrompt: 'nested cwd'
    })

    expect(result.kind).toBe('managed')
    if (result.kind === 'managed') {
      expect(result.executionCwd).not.toBe(rows[0].worktreeRoot)
      expect(result.executionCwd).toBe(join(rows[0].worktreeRoot, 'packages', 'web'))
      expect(isWithinDir(result.executionCwd, rows[0].worktreeRoot)).toBe(true)
    }
  })

  // 0210 D-105 가 0209 R-08(dirty 거부)을 대체한다. `worktree add` 는 source 트리를 건드리지
  // 않으므로 미커밋 변경은 격리를 막을 이유가 아니다 — 대신 그 변경이 **그 자리에 남는지**를 본다.
  it('tracked·untracked 변경이 있어도 격리를 만들고 source 트리를 그대로 둔다 (AC1 · AC2)', async () => {
    const repo = await repository()
    const managed = await mkdtemp(join(tmpdir(), 'orca-managed-dirty-'))
    roots.push(managed)
    await writeFile(join(repo, 'untracked.txt'), 'dirty')
    await writeFile(join(repo, 'README.md'), 'modified\n')
    const before = await exec('git', ['-C', repo, 'status', '--porcelain', '--untracked-files=all'])
    const rows: unknown[] = []
    const db = { insertManagedWorktree: (row: unknown) => rows.push(row) } as unknown as DbQueries

    const result = await new WorktreeService(db, managed).prepare({
      sourceCwd: repo,
      firstPrompt: 'work'
    })

    expect(result.kind).toBe('managed')
    expect(rows).toHaveLength(1)
    // 사용자 작업 트리는 손대지 않는다 — 이 단언이 없으면 stash/commit 을 몰래 하는 구현도 통과한다.
    const after = await exec('git', ['-C', repo, 'status', '--porcelain', '--untracked-files=all'])
    expect(after.stdout).toBe(before.stdout)
    expect(before.stdout.trim()).not.toBe('')
  })

  // AC9 · AC10 · AC11 — 유예된 브랜치가 base 다. HEAD 를 그대로 쓰는 구현은 두 커밋이 갈린
  // 저장소에서만 반증되므로 base 브랜치를 따로 만든다.
  it('유예된 기준 브랜치의 커밋에서 worktree 를 만든다 (AC10)', async () => {
    const repo = await repository()
    const initial = (
      await exec('git', ['-C', repo, 'rev-parse', '--abbrev-ref', 'HEAD'])
    ).stdout.trim()
    await exec('git', ['-C', repo, 'checkout', '-b', 'feature'])
    await writeFile(join(repo, 'feature.txt'), 'feature\n')
    await exec('git', ['-C', repo, 'add', '.'])
    await exec('git', ['-C', repo, 'commit', '-m', 'feature commit'])
    const featureOid = (await exec('git', ['-C', repo, 'rev-parse', 'feature'])).stdout.trim()
    // HEAD 는 원래 브랜치로 되돌려 둔다 — 두 값이 다를 때만 이 단언이 의미를 갖는다.
    await exec('git', ['-C', repo, 'checkout', initial])
    const headOid = (await exec('git', ['-C', repo, 'rev-parse', 'HEAD'])).stdout.trim()
    expect(headOid).not.toBe(featureOid)

    const managed = await mkdtemp(join(tmpdir(), 'orca-managed-base-'))
    roots.push(managed)
    const rows: Array<{ baseOid: string }> = []
    const db = {
      insertManagedWorktree: (row: { baseOid: string }) => rows.push(row)
    } as unknown as DbQueries

    const result = await new WorktreeService(db, managed).prepare({
      sourceCwd: repo,
      firstPrompt: 'work',
      baseRef: 'feature'
    })

    expect(result.kind).toBe('managed')
    expect(rows[0].baseOid).toBe(featureOid)
    expect(result).toMatchObject({ kind: 'managed', baseOid: featureOid })
    if (result.kind === 'managed') {
      const head = await exec('git', ['-C', result.executionCwd, 'rev-parse', 'HEAD'])
      expect(head.stdout.trim()).toBe(featureOid)
    }
  })

  it('없는 기준 브랜치는 거부한다 — HEAD 로 조용히 대체하지 않는다 (AC10)', async () => {
    const repo = await repository()
    const managed = await mkdtemp(join(tmpdir(), 'orca-managed-noref-'))
    roots.push(managed)
    const rows: unknown[] = []
    const db = { insertManagedWorktree: (row: unknown) => rows.push(row) } as unknown as DbQueries

    const result = await new WorktreeService(db, managed).prepare({
      sourceCwd: repo,
      firstPrompt: 'work',
      baseRef: 'no-such-branch'
    })

    expect(result).toMatchObject({ kind: 'rejected', reason: 'create-failed' })
    expect(rows).toEqual([])
  })

  it('별칭 managed root에서 add가 실패로 끝나면 생성된 worktree와 빈 bucket을 rollback한다', async () => {
    const repo = await repository()
    const physical = await mkdtemp(join(tmpdir(), 'orca-managed-real-'))
    roots.push(physical)
    const aliasParent = await mkdtemp(join(tmpdir(), 'orca-managed-alias-'))
    roots.push(aliasParent)
    const alias = join(aliasParent, 'managed')
    await symlink(physical, alias, 'dir')
    const removeCalls: string[] = []
    const service = new WorktreeService({} as DbQueries, alias, {
      add: async (input) => {
        const result = await addWorktree(input)
        expect(result.ok).toBe(true)
        return { ...result, ok: false }
      },
      list: listWorktrees,
      remove: async (input) => {
        // Git may report a symlink/junction target using a different textual path on Windows.
        // Capture the filesystem identity before removeWorktree deletes that path.
        removeCalls.push(await realpath(input.path))
        return removeWorktree(input)
      },
      deleteBranch
    })

    await expect(
      service.prepare({ sourceCwd: repo, firstPrompt: 'rollback alias' })
    ).resolves.toMatchObject({ kind: 'rejected', reason: 'create-failed' })
    expect(removeCalls).toHaveLength(1)
    expect(isWithinDir(removeCalls[0], await realpath(physical))).toBe(true)
    const remaining = await listWorktrees(repo)
    expect(remaining).toHaveLength(1)
    const mainWorktree = remaining?.[0]
    expect(mainWorktree).toBeDefined()
    if (!mainWorktree) throw new Error('main worktree was not preserved')
    const canonicalRepo = await realpath(repo)
    const canonicalMain = await realpath(mainWorktree.path)
    expect(isWithinDir(canonicalMain, canonicalRepo)).toBe(true)
    expect(isWithinDir(canonicalRepo, canonicalMain)).toBe(true)
    expect(mainWorktree.branch).toBe('master')
    expect(await import('node:fs/promises').then(({ readdir }) => readdir(physical))).toEqual([])
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
