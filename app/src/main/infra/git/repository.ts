import { realpath, stat } from 'node:fs/promises'
import { normalize } from 'node:path'
import { runGit } from './runner'

export async function canonicalPath(path: string): Promise<string> {
  return normalize(await realpath(path))
}

export async function resolveRepoRoot(cwd: string): Promise<string | null> {
  const dir = await stat(cwd).catch(() => null)
  if (!dir?.isDirectory()) return null
  const result = await runGit(cwd, ['rev-parse', '--show-toplevel'], { readOnly: true })
  return result.ok && result.stdout.trim() ? canonicalPath(result.stdout.trim()) : null
}

export async function resolveHead(cwd: string): Promise<string | null> {
  const result = await runGit(cwd, ['rev-parse', '--verify', 'HEAD'], { readOnly: true })
  const oid = result.stdout.trim()
  return result.ok && /^[0-9a-fA-F]{40,64}$/.test(oid) ? oid : null
}

export async function isClean(cwd: string): Promise<boolean | null> {
  const result = await runGit(cwd, ['status', '--porcelain', '--untracked-files=all'], {
    readOnly: true
  })
  return result.ok ? result.stdout.trim().length === 0 : null
}

export async function validateBranchName(repoRoot: string, branch: string): Promise<boolean> {
  const result = await runGit(repoRoot, ['check-ref-format', '--branch', branch], {
    readOnly: true
  })
  return result.ok
}

export async function branchExists(repoRoot: string, branch: string): Promise<boolean> {
  const result = await runGit(
    repoRoot,
    ['show-ref', '--verify', '--quiet', `refs/heads/${branch}`],
    {
      readOnly: true
    }
  )
  return result.ok
}
