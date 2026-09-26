// 브랜치 조회와 전환. 읽기/변경 실행 정책은 gateway 한 곳이 소유한다.
import type { GitBranchList, GitCheckoutResult, GitDirtyResolution } from '../../../shared/ipc'
import { GitBranchNameSchema } from '../../../shared/protocol'
import { firstErrorLine, parseBranchList, parseShortstat } from './git-parse'
import { gitGateway, type GitGateway, type GitWrite, type GitRunResult } from './gateway'
import { probeRepo } from './probe'
import { buildStatus } from './git-snapshot'
import { DIFF_SAFETY_ARGS } from './git-diff'

export async function gitBranches(
  cwd: string,
  gateway: GitGateway = gitGateway
): Promise<GitBranchList> {
  const probe = await probeRepo(cwd, gateway)
  if (probe.kind !== 'repo') return { current: null, branches: [] }
  const current = probe.head.kind === 'detached' ? null : probe.head.name
  const result = await gateway.read(cwd, [
    'for-each-ref',
    '--format=%(refname:short)',
    'refs/heads/'
  ])
  return { current, branches: result.ok ? parseBranchList(result.stdout, current) : [] }
}
function resolveDirty(
  cwd: string,
  resolution: GitDirtyResolution,
  target: string,
  write: GitWrite
): Promise<GitRunResult> {
  if (resolution === 'stash')
    return write(cwd, ['stash', 'push', '-m', `orca: auto-stash before switching to ${target}`])
  if (resolution === 'commit-wip') return write(cwd, ['commit', '-a', '-m', 'WIP'])
  return write(cwd, ['reset', '--hard', 'HEAD'])
}
export async function gitCheckout(
  cwd: string,
  branch: string,
  resolution?: GitDirtyResolution,
  gateway: GitGateway = gitGateway
): Promise<GitCheckoutResult> {
  if (!GitBranchNameSchema.safeParse(branch).success) {
    return { ok: false, reason: 'error', message: 'branch 이름이 올바르지 않습니다.' }
  }
  const probe = await probeRepo(cwd, gateway)
  if (probe.kind !== 'repo')
    return { ok: false, reason: 'not-repo', message: 'git 저장소가 아닙니다.' }
  const stat =
    probe.head.kind !== 'unborn'
      ? await gateway.read(cwd, ['diff', ...DIFF_SAFETY_ARGS, 'HEAD', '--shortstat'])
      : null
  const dirty = stat?.ok ? parseShortstat(stat.stdout) : null
  if (dirty && resolution === undefined) {
    return {
      ok: false,
      reason: 'dirty',
      from: probe.head.kind === 'detached' ? null : probe.head.name,
      stat: dirty
    }
  }
  const result = await gateway.mutate(
    probe.root,
    async (write): Promise<Exclude<GitCheckoutResult, { ok: true }> | { ok: true }> => {
      let applied: GitDirtyResolution | undefined
      if (dirty) {
        const resolved = await resolveDirty(cwd, resolution as GitDirtyResolution, branch, write)
        if (!resolved.ok)
          return {
            ok: false,
            reason: 'error',
            message: firstErrorLine(resolved.stderr) || '변경 사항을 처리하지 못했습니다.'
          }
        applied = resolution
      }
      const checkout = await write(cwd, ['checkout', branch])
      if (!checkout.ok)
        return {
          ok: false,
          reason: 'error',
          message: firstErrorLine(checkout.stderr) || '브랜치를 전환하지 못했습니다.',
          ...(applied ? { applied } : {})
        }
      return { ok: true }
    }
  )
  if (!result.ok) return result
  const after = await probeRepo(cwd, gateway)
  return { ok: true, branch, status: await buildStatus(cwd, after, gateway) }
}
