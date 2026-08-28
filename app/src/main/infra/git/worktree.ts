import { runGit, type GitRunResult } from './runner'
import { withRepoMutation } from './mutation-queue'

export interface WorktreeEntry {
  path: string
  branch: string | null
  head: string | null
}

export async function addWorktree(input: {
  repoRoot: string
  path: string
  branch: string
  base: string
  signal?: AbortSignal
}): Promise<GitRunResult> {
  return withRepoMutation(input.repoRoot, () =>
    runGit(input.repoRoot, ['worktree', 'add', '-b', input.branch, input.path, input.base], {
      timeoutMs: 30_000,
      ...(input.signal ? { signal: input.signal } : {})
    })
  )
}

export async function removeWorktree(input: {
  repoRoot: string
  path: string
}): Promise<GitRunResult> {
  return withRepoMutation(input.repoRoot, () =>
    runGit(input.repoRoot, ['worktree', 'remove', input.path], { timeoutMs: 30_000 })
  )
}

export async function deleteBranch(input: {
  repoRoot: string
  branch: string
}): Promise<GitRunResult> {
  return withRepoMutation(input.repoRoot, () =>
    runGit(input.repoRoot, ['branch', '-d', input.branch])
  )
}

export function parseWorktreeList(stdout: string): WorktreeEntry[] {
  return stdout
    .trim()
    .split(/\r?\n\r?\n/)
    .filter(Boolean)
    .map((block) => {
      const lines = block.split(/\r?\n/)
      const value = (prefix: string): string | null =>
        lines.find((line) => line.startsWith(prefix))?.slice(prefix.length) ?? null
      const branchRef = value('branch ')
      return {
        path: value('worktree ') ?? '',
        head: value('HEAD '),
        branch: branchRef?.replace(/^refs\/heads\//, '') ?? null
      }
    })
    .filter((entry) => entry.path.length > 0)
}

export async function listWorktrees(repoRoot: string): Promise<WorktreeEntry[] | null> {
  const result = await runGit(repoRoot, ['worktree', 'list', '--porcelain'], { readOnly: true })
  return result.ok ? parseWorktreeList(result.stdout) : null
}
