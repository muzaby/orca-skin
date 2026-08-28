import { randomUUID } from 'node:crypto'
import { mkdir, realpath, rm, stat } from 'node:fs/promises'
import { dirname, relative, resolve } from 'node:path'
import type { DbQueries } from '../../infra/db'
import { isWithinDir } from '../../infra/config/paths'
import { canonicalPath, isClean, resolveHead, resolveRepoRoot } from '../../infra/git/repository'
import { addWorktree, deleteBranch, removeWorktree } from '../../infra/git/worktree'
import { chooseBranchName } from './naming'

export type PrepareWorktreeResult =
  | { kind: 'managed'; worktreeId: string; executionCwd: string }
  | {
      kind: 'rejected'
      reason: 'git-unavailable' | 'not-repo' | 'dirty' | 'invalid-path' | 'create-failed'
      message: string
    }

export type DeleteManagedWorktreeResult =
  | { ok: true }
  | {
      ok: false
      reason:
        | 'worktree-dirty'
        | 'worktree-has-commits'
        | 'worktree-check-failed'
        | 'worktree-remove-failed'
      message: string
    }

export class WorktreeService {
  constructor(
    private readonly db: DbQueries,
    private readonly rootDir: string
  ) {}

  async prepare(input: {
    sourceCwd: string
    firstPrompt: string
    signal?: AbortSignal
    complete?: (prompt: string, signal: AbortSignal) => Promise<string>
  }): Promise<PrepareWorktreeResult> {
    const sourceCwd = await canonicalPath(input.sourceCwd).catch(() => null)
    if (!sourceCwd)
      return { kind: 'rejected', reason: 'invalid-path', message: '작업 경로를 찾을 수 없습니다.' }
    const repoRoot = await resolveRepoRoot(sourceCwd)
    if (!repoRoot)
      return { kind: 'rejected', reason: 'not-repo', message: 'Git 저장소가 아닙니다.' }
    const subpath = relative(repoRoot, sourceCwd)
    if (subpath.startsWith('..'))
      return { kind: 'rejected', reason: 'invalid-path', message: '저장소 밖의 작업 경로입니다.' }
    const clean = await isClean(sourceCwd)
    if (clean == null)
      return {
        kind: 'rejected',
        reason: 'git-unavailable',
        message: 'Git 상태를 확인하지 못했습니다.'
      }
    if (!clean)
      return {
        kind: 'rejected',
        reason: 'dirty',
        message:
          'Worktree 격리는 커밋된 현재 HEAD에서 시작합니다. 현재 작업 경로에 커밋되지 않은 변경이 있습니다.'
      }
    const baseOid = await resolveHead(sourceCwd)
    if (!baseOid)
      return {
        kind: 'rejected',
        reason: 'create-failed',
        message: '현재 HEAD를 확인하지 못했습니다.'
      }
    const repoId = randomUUID()
    const worktreeId = randomUUID()
    const worktreeRoot = resolve(this.rootDir, repoId, worktreeId)
    const branch = await chooseBranchName({
      repoRoot,
      worktreeId,
      firstPrompt: input.firstPrompt,
      ...(input.complete ? { complete: input.complete } : {}),
      ...(input.signal ? { signal: input.signal } : {})
    })
    await mkdir(dirname(worktreeRoot), { recursive: true })
    const added = await addWorktree({
      repoRoot,
      path: worktreeRoot,
      branch,
      base: baseOid,
      ...(input.signal ? { signal: input.signal } : {})
    })
    if (!added.ok) {
      await deleteBranch({ repoRoot, branch })
      return { kind: 'rejected', reason: 'create-failed', message: 'Worktree를 만들지 못했습니다.' }
    }
    try {
      const actualRoot = await realpath(worktreeRoot)
      const executionCwd = resolve(actualRoot, subpath)
      if (!isWithinDir(executionCwd, actualRoot)) throw new Error('invalid execution cwd')
      if (!(await stat(executionCwd)).isDirectory()) throw new Error('missing execution cwd')
      this.db.insertManagedWorktree({
        id: worktreeId,
        repoRoot,
        sourceCwd,
        worktreeRoot: actualRoot,
        branch,
        baseOid,
        createdAt: Date.now()
      })
      return { kind: 'managed', worktreeId, executionCwd }
    } catch {
      await removeWorktree({ repoRoot, path: worktreeRoot })
      await deleteBranch({ repoRoot, branch })
      await rm(worktreeRoot, { recursive: true, force: true }).catch(() => undefined)
      return {
        kind: 'rejected',
        reason: 'create-failed',
        message: 'Worktree 정보를 저장하지 못했습니다.'
      }
    }
  }

  async removeForSession(sessionId: string): Promise<DeleteManagedWorktreeResult> {
    const row = this.db.getManagedWorktreeBySession(sessionId)
    if (!row) return { ok: true }
    const clean = await isClean(row.worktree_root)
    if (clean == null)
      return {
        ok: false,
        reason: 'worktree-check-failed',
        message: 'Worktree 상태를 확인하지 못해 세션을 보존했습니다.'
      }
    if (!clean)
      return {
        ok: false,
        reason: 'worktree-dirty',
        message: 'Worktree에 커밋되지 않은 변경이 있어 세션을 삭제하지 않았습니다.'
      }
    const head = await resolveHead(row.worktree_root)
    if (!head)
      return {
        ok: false,
        reason: 'worktree-check-failed',
        message: 'Worktree HEAD를 확인하지 못해 세션을 보존했습니다.'
      }
    if (head !== row.base_oid)
      return {
        ok: false,
        reason: 'worktree-has-commits',
        message: 'Worktree에 새 커밋이 있어 세션을 삭제하지 않았습니다.'
      }
    const removed = await removeWorktree({ repoRoot: row.repo_root, path: row.worktree_root })
    if (!removed.ok)
      return {
        ok: false,
        reason: 'worktree-remove-failed',
        message: 'Worktree를 안전하게 제거하지 못해 세션을 보존했습니다.'
      }
    await deleteBranch({ repoRoot: row.repo_root, branch: row.branch })
    this.db.deleteManagedWorktree(row.id)
    return { ok: true }
  }
}
