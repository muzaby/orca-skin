import { realpath } from 'node:fs/promises'
import { normalize } from 'node:path'
import { gitGateway, type GitGateway } from './gateway'
import { headOid, isGitOid, probeRepo } from './probe'

export async function canonicalPath(path: string): Promise<string> {
  return normalize(await realpath(path))
}
export async function resolveHead(
  cwd: string,
  gateway: GitGateway = gitGateway
): Promise<string | null> {
  const probe = await probeRepo(cwd, gateway)
  return probe.kind === 'repo' ? headOid(probe.head) : null
}
export async function resolveBranchOid(
  cwd: string,
  branch: string,
  gateway: GitGateway = gitGateway
): Promise<string | null> {
  const result = await gateway.read(cwd, ['rev-parse', '--verify', `refs/heads/${branch}^{commit}`])
  const oid = result.stdout.trim()
  return result.ok && isGitOid(oid) ? oid : null
}
export async function isClean(
  cwd: string,
  gateway: GitGateway = gitGateway
): Promise<boolean | null> {
  const result = await gateway.read(cwd, ['status', '--porcelain', '--untracked-files=all'])
  return result.ok ? result.stdout.trim().length === 0 : null
}
export async function validateBranchName(
  repoRoot: string,
  branch: string,
  gateway: GitGateway = gitGateway
): Promise<boolean> {
  return (await gateway.read(repoRoot, ['check-ref-format', '--branch', branch])).ok
}
export async function listBranchRefs(
  repoRoot: string,
  base: string,
  gateway: GitGateway = gitGateway
): Promise<Set<string> | null> {
  const result = await gateway.read(repoRoot, [
    'for-each-ref',
    '--format=%(refname)',
    `refs/heads/${base}`,
    `refs/heads/${base}-*`
  ])
  return result.ok ? new Set(result.stdout.trim().split(/\r?\n/).filter(Boolean)) : null
}
