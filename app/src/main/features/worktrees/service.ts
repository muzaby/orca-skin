import { randomUUID } from 'node:crypto'
import { mkdir, realpath, rm, rmdir, stat } from 'node:fs/promises'
import { basename, dirname, relative, resolve } from 'node:path'
import type { WorktreeDisplay, WorktreePrepareStep } from '../../../shared/ipc'
import type { DbQueries } from '../../infra/db'
import { isWithinDir } from '../../infra/config/paths'
import {
  canonicalPath,
  gitAvailable,
  isClean,
  resolveBranchOid,
  resolveHead,
  resolveHeadRef,
  resolveRepoRoot
} from '../../infra/git/repository'
import { addWorktree, deleteBranch, listWorktrees, removeWorktree } from '../../infra/git/worktree'
import { branchDirSegment, chooseBranchName, repoDirSegment } from './naming'

// `dirty` 는 이유 목록에 없다 (0210 D-105). `git worktree add` 는 source 작업 트리를 건드리지
// 않으므로 미커밋 변경은 격리를 막을 이유가 아니다 — 그 변경이 새 worktree 에 따라오지 않는다는
// 사실은 칩 툴팁이 알린다. 죽은 분기를 타입에 남겨두면 다음 독자가 정책을 오독한다.
export type PrepareWorktreeResult =
  | {
      kind: 'managed'
      worktreeId: string
      executionCwd: string
      // 세션 출생 baseline의 단일 원본. managed_worktrees에 저장한 같은 값을 그대로 싣는다.
      baseOid: string
      // 0211 ΔV4 — 그 baseline 커밋이 놓여 있던 **브랜치 이름**(D-072). `baseOid` 와 같은
      // 자리에서 결정되므로 함께 싣는다: 소비자가 렌더 시점에 `symbolic-ref` 를 다시 부르는
      // 역산을 발명하지 않게 한다. detached HEAD 면 null.
      baseRef: string | null
      // 0211 — 사람이 읽는 이름의 정본. 실행 경로와 **다른 값**이라 결과에 함께 싣는다:
      // 소비자가 `executionCwd` 에서 원본을 역산하지 않게 한다.
      display: WorktreeDisplay
    }
  | {
      kind: 'rejected'
      reason: 'git-unavailable' | 'not-repo' | 'invalid-path' | 'create-failed'
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

type WorktreeOperations = {
  add: typeof addWorktree
  remove: typeof removeWorktree
  list: typeof listWorktrees
  deleteBranch: typeof deleteBranch
}

// 디렉토리 존재 확인. **캐시하지 않는다** — 외부 삭제를 보는 것이 이 술어의 목적이라
// 캐시하는 순간 폴백이 영원히 발화하지 않는다(0210 §14).
async function pathExists(path: string): Promise<boolean> {
  return stat(path).then(
    () => true,
    () => false
  )
}

const defaultWorktreeOperations: WorktreeOperations = {
  add: addWorktree,
  remove: removeWorktree,
  list: listWorktrees,
  deleteBranch
}

export class WorktreeService {
  constructor(
    private readonly db: DbQueries,
    private readonly rootDir: string,
    private readonly operations: WorktreeOperations = defaultWorktreeOperations
  ) {}

  async prepare(input: {
    sourceCwd: string
    firstPrompt: string
    // 컴포저에서 유예된 브랜치 (0210 D-101). 미지정이면 현재 HEAD 가 base 다.
    baseRef?: string
    signal?: AbortSignal
    complete?: (prompt: string, signal: AbortSignal) => Promise<string>
    // 준비 진행 통지 (0211 D-003). **일을 시작하기 직전**에 부른다 — 완료 시점에 부르면
    // 사용자가 기다리는 동안 무엇을 기다리는지가 아니라 무엇이 끝났는지를 읽는다.
    // electron 을 여기서 알지 않기 위해 콜백이다: renderer 발신은 컴포지션 루트가 한다.
    onProgress?: (step: WorktreePrepareStep) => void
  }): Promise<PrepareWorktreeResult> {
    input.onProgress?.('repo')
    const sourceCwd = await canonicalPath(input.sourceCwd).catch(() => null)
    if (!sourceCwd)
      return { kind: 'rejected', reason: 'invalid-path', message: '작업 경로를 찾을 수 없습니다.' }
    const repoRoot = await resolveRepoRoot(sourceCwd)
    if (!repoRoot)
      return (await gitAvailable(sourceCwd))
        ? { kind: 'rejected', reason: 'not-repo', message: 'Git 저장소가 아닙니다.' }
        : {
            kind: 'rejected',
            reason: 'git-unavailable',
            message: 'Git 을 실행하지 못했습니다.'
          }
    const subpath = relative(repoRoot, sourceCwd)
    if (subpath.startsWith('..'))
      return { kind: 'rejected', reason: 'invalid-path', message: '저장소 밖의 작업 경로입니다.' }
    input.onProgress?.('base')
    // base 는 **한 번만** 읽는다. 유예된 브랜치가 있으면 그 브랜치의 커밋, 없으면 현재 HEAD.
    //
    // 0211 ΔV4 — 이름도 **같은 자리에서** 결정한다(D-072). 유예 브랜치가 있으면 그 이름이 곧
    // 기준 브랜치이고, 없으면 지금 체크아웃된 브랜치다. 이름을 나중에 다시 읽으면 그 사이
    // 사용자가 브랜치를 바꿨을 때 커밋과 이름이 서로 다른 시점을 가리킨다.
    const baseRef = input.baseRef ?? (await resolveHeadRef(sourceCwd))
    const baseOid = input.baseRef
      ? await resolveBranchOid(sourceCwd, input.baseRef)
      : await resolveHead(sourceCwd)
    if (!baseOid)
      return {
        kind: 'rejected',
        reason: 'create-failed',
        message: input.baseRef
          ? `기준 브랜치(${input.baseRef})를 확인하지 못했습니다.`
          : '현재 HEAD를 확인하지 못했습니다.'
      }
    input.onProgress?.('branch')
    const worktreeId = randomUUID()
    const repoSegment = repoDirSegment(repoRoot)
    const branch = await chooseBranchName({
      repoRoot,
      worktreeId,
      firstPrompt: input.firstPrompt,
      ...(input.complete ? { complete: input.complete } : {}),
      ...(input.signal ? { signal: input.signal } : {}),
      dirTaken: async (candidate) =>
        await stat(resolve(this.rootDir, repoSegment, branchDirSegment(candidate)))
          .then(() => true)
          .catch(() => false)
    })
    input.onProgress?.('worktree')
    const worktreeRoot = resolve(this.rootDir, repoSegment, branchDirSegment(branch))
    await mkdir(dirname(worktreeRoot), { recursive: true })
    const added = await this.operations.add({
      repoRoot,
      path: worktreeRoot,
      branch,
      base: baseOid,
      ...(input.signal ? { signal: input.signal } : {})
    })
    if (!added.ok) {
      const entries = await this.operations.list(repoRoot)
      const canonicalParent = await realpath(dirname(worktreeRoot)).catch(() => null)
      const canonicalCandidate = canonicalParent
        ? resolve(canonicalParent, basename(worktreeRoot))
        : worktreeRoot
      const created = entries?.find(
        (entry) =>
          isWithinDir(entry.path, canonicalCandidate) && isWithinDir(canonicalCandidate, entry.path)
      )
      if (created) await this.operations.remove({ repoRoot, path: created.path })
      await this.operations.deleteBranch({ repoRoot, branch })
      await rm(worktreeRoot, { recursive: true, force: true }).catch(() => undefined)
      await rmdir(dirname(worktreeRoot)).catch(() => undefined)
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
      return {
        kind: 'managed',
        worktreeId,
        executionCwd,
        baseOid,
        baseRef,
        display: { sourceCwd, repoRoot }
      }
    } catch {
      await this.operations.remove({ repoRoot, path: worktreeRoot })
      await this.operations.deleteBranch({ repoRoot, branch })
      await rm(worktreeRoot, { recursive: true, force: true }).catch(() => undefined)
      return {
        kind: 'rejected',
        reason: 'create-failed',
        message: 'Worktree 정보를 저장하지 못했습니다.'
      }
    }
  }

  // 실행 경로가 사라진 세션을 원본 작업 경로로 되돌린다 (0210 D-107).
  //
  // **`none` 과 `unrecoverable` 은 다르다.** 전자는 폴백할 이유가 없는 정상 resume(경로가 산다)
  // 이거나 managed 세션이 아닌 경우고, 후자는 되돌릴 원본마저 사라진 경우다 — 전자를 오류로
  // 접으면 모든 정상 턴이 죽고, 후자를 정상으로 접으면 없는 경로로 spawn 해 0210 이 고치려는
  // 그 오진 문구가 다시 난다.
  //
  // DB 두 쓰기의 순서가 계약이다(§13): 세션행 먼저, metadata 삭제가 뒤. 사이에서 죽으면 남는
  // 것은 stale metadata 뿐이고, 다음 폴백 시도가 같은 판정으로 그것을 다시 지운다.
  async recoverMissingWorktree(input: {
    sessionId: string
    executionCwd: string
    now?: number
  }): Promise<
    | { kind: 'none' }
    | { kind: 'recovered'; executionCwd: string; lostWorktreeRoot: string }
    | { kind: 'unrecoverable'; lostWorktreeRoot: string }
  > {
    if (await pathExists(input.executionCwd)) return { kind: 'none' }
    const row = this.db.getManagedWorktreeBySession(input.sessionId)
    if (!row) return { kind: 'none' }
    if (!(await pathExists(row.source_cwd)))
      return { kind: 'unrecoverable', lostWorktreeRoot: row.worktree_root }
    this.db.updateSessionCwd(input.sessionId, row.source_cwd, input.now ?? Date.now())
    this.db.deleteManagedWorktree(row.id)
    return { kind: 'recovered', executionCwd: row.source_cwd, lostWorktreeRoot: row.worktree_root }
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
    const removed = await this.operations.remove({
      repoRoot: row.repo_root,
      path: row.worktree_root
    })
    if (!removed.ok)
      return {
        ok: false,
        reason: 'worktree-remove-failed',
        message: 'Worktree를 안전하게 제거하지 못해 세션을 보존했습니다.'
      }
    await this.operations.deleteBranch({ repoRoot: row.repo_root, branch: row.branch })
    this.db.deleteManagedWorktree(row.id)
    return { ok: true }
  }
}
