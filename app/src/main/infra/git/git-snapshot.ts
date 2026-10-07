import type { GitSnapshotResult, GitStatus } from '../../../shared/ipc'
import { gitGateway, type GitGateway } from './gateway'
import { headName, probeRepo, type RepoProbe } from './probe'
import { EMPTY_DIFF_SUMMARY, gitDiffSummary, type DiffInput } from './git-diff'
import { githubRepositoryUrl } from './github-url'

export const NOT_REPO: GitStatus = {
  isRepo: false,
  branch: null,
  detached: false,
  root: null,
  githubUrl: null
}

export async function buildStatus(
  cwd: string,
  probe: RepoProbe,
  gateway: Pick<GitGateway, 'read'> = gitGateway
): Promise<GitStatus> {
  if (probe.kind !== 'repo') return NOT_REPO
  // Git resolves local/global includes and insteadOf for every request.
  const origin = await gateway.read(cwd, ['remote', 'get-url', 'origin'])
  return {
    isRepo: true,
    root: probe.root,
    branch: headName(probe.head),
    detached: probe.head.kind === 'detached',
    githubUrl: origin.ok ? githubRepositoryUrl(origin.stdout) : null
  }
}

export async function gitSnapshot(
  input: DiffInput & { includeSummary: boolean },
  gateway: GitGateway = gitGateway
): Promise<GitSnapshotResult> {
  const probe = await probeRepo(input.cwd, gateway)
  const [status, summary] = await Promise.all([
    buildStatus(input.cwd, probe, gateway),
    input.includeSummary
      ? probe.kind === 'repo'
        ? gitDiffSummary(input, gateway.read, probe)
        : Promise.resolve(EMPTY_DIFF_SUMMARY)
      : Promise.resolve(null)
  ])
  return { status, summary }
}
