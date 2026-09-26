import { gitGateway, type GitGateway, type GitRunResult } from './gateway'

export interface WorktreeEntry {
  path: string
  branch: string | null
  head: string | null
}

export async function addWorktree(
  input: {
    repoRoot: string
    path: string
    branch: string
    base: string
    signal?: AbortSignal
  },
  gateway: GitGateway = gitGateway
): Promise<GitRunResult> {
  return gateway.mutate(input.repoRoot, (write) =>
    write(input.repoRoot, ['worktree', 'add', '-b', input.branch, input.path, input.base], {
      timeoutMs: 30_000,
      ...(input.signal ? { signal: input.signal } : {})
    })
  )
}

export async function removeWorktree(
  input: {
    repoRoot: string
    path: string
  },
  gateway: GitGateway = gitGateway
): Promise<GitRunResult> {
  return gateway.mutate(input.repoRoot, (write) =>
    write(input.repoRoot, ['worktree', 'remove', input.path], { timeoutMs: 30_000 })
  )
}

export async function deleteBranch(
  input: {
    repoRoot: string
    branch: string
  },
  gateway: GitGateway = gitGateway
): Promise<GitRunResult> {
  return gateway.mutate(input.repoRoot, (write) =>
    write(input.repoRoot, ['branch', '-d', input.branch])
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

export async function listWorktrees(
  repoRoot: string,
  gateway: GitGateway = gitGateway
): Promise<WorktreeEntry[] | null> {
  const result = await gateway.read(repoRoot, ['worktree', 'list', '--porcelain'])
  return result.ok ? parseWorktreeList(result.stdout) : null
}

export async function repairWorktree(
  repoRoot: string,
  worktreeRoot: string,
  gateway: GitGateway = gitGateway
): Promise<GitRunResult> {
  return gateway.mutate(repoRoot, (write) => write(repoRoot, ['worktree', 'repair', worktreeRoot]))
}
