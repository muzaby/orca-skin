// 0225 이관의 **DB·git 단계**. 파일시스템 이관(`infra/config/migrate-legacy.ts`)이 디렉토리를
// 옮긴 뒤, 그 안을 가리키던 저장 절대경로를 새 루트로 다시 적고 옮겨진 워크트리의 git 링크를
// 고친다. 부팅 순서상 **DB 오픈 직후·핸들러 등록 이전**이다 — 세션 재개가 옛 경로를 보기 전에
// 끝나야 하고, 다음 `worktree add` 의 자동 prune 이 워크트리를 파괴하기 전에 끝나야 한다.
//
// 저장된 절대경로는 **스냅샷이지 정본이 아니다**(§12). 그래서 재계산하지 않고 접두만 바꾼다 —
// `repoDirSegment`+`branchDirSegment` 로 재계산하면 브랜치 개명 이력이 있는 행이 다른 값을 낸다.
//
// **repair 는 repo 측에서 부른다** — `git worktree repair <worktree>`. 워크트리 측 무인자 호출은
// 저장소가 함께 이동한 경우(세션 cwd 가 설정 루트 하위 저장소일 때) `fatal: not a git repository`
// 로 실패한다. repo 측 호출은 같은 상황에서 `gitdir` 과 워크트리의 `.git` 파일을 **둘 다** 고친다.

import { existsSync } from 'node:fs'
import type Database from 'better-sqlite3'
import { rebaseUnderRoot } from '../infra/config/rebase-path'
import { runGit } from '../infra/git/runner'

export interface RebaseCounts {
  sessionCwd: number
  sessionExtraDirs: number
  repoRoot: number
  sourceCwd: number
  worktreeRoot: number
}

export interface RebaseReport {
  counts: RebaseCounts
  /** repair 를 시도해야 하는 워크트리 — 경로가 바뀐 행만. */
  repairTargets: { repoRoot: string; worktreeRoot: string }[]
  repaired: string[]
  repairFailed: { worktreeRoot: string; message: string }[]
}

type GitRunner = typeof runGit

interface SessionRow {
  id: string
  cwd: string | null
  extra_dirs: string | null
}

interface WorktreeRow {
  id: string
  repo_root: string
  source_cwd: string
  worktree_root: string
}

function rebaseJsonArray(raw: string, oldRoot: string, newRoot: string): string | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return null
  }
  if (!Array.isArray(parsed)) return null
  let changed = false
  const next = parsed.map((entry) => {
    if (typeof entry !== 'string') return entry
    const rebased = rebaseUnderRoot(entry, oldRoot, newRoot)
    if (rebased === null) return entry
    changed = true
    return rebased
  })
  return changed ? JSON.stringify(next) : null
}

/**
 * 저장 절대경로 5컬럼(`sessions.cwd`·`sessions.extra_dirs`·`managed_worktrees.repo_root`·
 * `.source_cwd`·`.worktree_root`)을 **한 트랜잭션**으로 새 루트 아래로 옮겨 적는다.
 * 전부 아니면 전무다 — 부분 적용은 세션마다 다른 루트를 가리키는 상태를 만든다.
 */
export function rebaseStoredPaths(
  db: Database.Database,
  oldRoot: string,
  newRoot: string
): RebaseReport {
  const counts: RebaseCounts = {
    sessionCwd: 0,
    sessionExtraDirs: 0,
    repoRoot: 0,
    sourceCwd: 0,
    worktreeRoot: 0
  }
  const repairTargets: { repoRoot: string; worktreeRoot: string }[] = []
  if (oldRoot === newRoot) return { counts, repairTargets, repaired: [], repairFailed: [] }

  const sessions = db
    .prepare(
      'SELECT id, cwd, extra_dirs FROM sessions WHERE cwd IS NOT NULL OR extra_dirs IS NOT NULL'
    )
    .all() as SessionRow[]
  const worktrees = db
    .prepare('SELECT id, repo_root, source_cwd, worktree_root FROM managed_worktrees')
    .all() as WorktreeRow[]

  const updateCwd = db.prepare('UPDATE sessions SET cwd = ? WHERE id = ?')
  const updateExtraDirs = db.prepare('UPDATE sessions SET extra_dirs = ? WHERE id = ?')
  const updateWorktree = db.prepare(
    'UPDATE managed_worktrees SET repo_root = ?, source_cwd = ?, worktree_root = ? WHERE id = ?'
  )

  db.transaction(() => {
    for (const row of sessions) {
      if (row.cwd !== null) {
        const next = rebaseUnderRoot(row.cwd, oldRoot, newRoot)
        if (next !== null) {
          updateCwd.run(next, row.id)
          counts.sessionCwd += 1
        }
      }
      if (row.extra_dirs !== null) {
        const next = rebaseJsonArray(row.extra_dirs, oldRoot, newRoot)
        if (next !== null) {
          updateExtraDirs.run(next, row.id)
          counts.sessionExtraDirs += 1
        }
      }
    }
    for (const row of worktrees) {
      const repoRoot = rebaseUnderRoot(row.repo_root, oldRoot, newRoot)
      const sourceCwd = rebaseUnderRoot(row.source_cwd, oldRoot, newRoot)
      const worktreeRoot = rebaseUnderRoot(row.worktree_root, oldRoot, newRoot)
      if (repoRoot === null && sourceCwd === null && worktreeRoot === null) continue
      if (repoRoot !== null) counts.repoRoot += 1
      if (sourceCwd !== null) counts.sourceCwd += 1
      if (worktreeRoot !== null) counts.worktreeRoot += 1
      const nextRepoRoot = repoRoot ?? row.repo_root
      const nextWorktreeRoot = worktreeRoot ?? row.worktree_root
      updateWorktree.run(nextRepoRoot, sourceCwd ?? row.source_cwd, nextWorktreeRoot, row.id)
      // repo 나 워크트리 어느 쪽이 움직여도 양방향 포인터 중 하나가 끊긴다.
      repairTargets.push({ repoRoot: nextRepoRoot, worktreeRoot: nextWorktreeRoot })
    }
  })()

  return { counts, repairTargets, repaired: [], repairFailed: [] }
}

/**
 * 경로가 바뀐 워크트리마다 repo 측 `git worktree repair <worktree>` 를 1회 부른다. 실패는
 * 부팅을 막지 않는다 — 해당 세션에서 0210 폴백(원본 작업 경로)이 동작하고, 실패한 경로는
 * 경고로 남는다. 이 단계는 멱등이라 다시 불러도 안전하다.
 */
export async function repairMovedWorktrees(
  report: RebaseReport,
  git: GitRunner = runGit
): Promise<RebaseReport> {
  for (const target of report.repairTargets) {
    if (!existsSync(target.repoRoot)) {
      report.repairFailed.push({
        worktreeRoot: target.worktreeRoot,
        message: `repo root missing: ${target.repoRoot}`
      })
      continue
    }
    const result = await git(target.repoRoot, ['worktree', 'repair', target.worktreeRoot])
    if (result.ok) report.repaired.push(target.worktreeRoot)
    else
      report.repairFailed.push({
        worktreeRoot: target.worktreeRoot,
        message: result.stderr.trim() || `exit ${String(result.code)}`
      })
  }
  return report
}
