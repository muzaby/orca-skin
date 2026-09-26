import { stat } from 'node:fs/promises'
import { resolve } from 'node:path'
import { gitGateway, type GitGateway } from './gateway'
import { canonicalRepoKey } from './mutation-queue'

export type RepoHead =
  | { kind: 'branch'; name: string; oid: string }
  | { kind: 'detached'; oid: string }
  | { kind: 'unborn'; name: string | null }
export type RepoProbe =
  | { kind: 'unavailable' }
  | { kind: 'not-repo' }
  | { kind: 'repo'; root: string; gitDir: string; commonDir: string; head: RepoHead }
export type RepositoryProbe = Extract<RepoProbe, { kind: 'repo' }>

export const isGitOid = (value: string): boolean => /^[0-9a-fA-F]{40,64}$/.test(value)
const COORDS = [
  'rev-parse',
  '--is-inside-work-tree',
  '--show-toplevel',
  '--git-dir',
  '--git-common-dir'
]

export async function probeRepo(
  cwd: string,
  gateway: Pick<GitGateway, 'read'> = gitGateway
): Promise<RepoProbe> {
  if (!(await stat(cwd).catch(() => null))?.isDirectory()) return { kind: 'not-repo' }
  const result = await gateway.read(cwd, [...COORDS, 'HEAD', '--symbolic-full-name', 'HEAD'])
  if (result.unavailable) return { kind: 'unavailable' }
  let lines = result.stdout.trim().split(/\r?\n/)
  let head: RepoHead
  if (result.ok && isGitOid(lines[4] ?? '')) {
    const ref = lines[5] ?? ''
    head = ref.startsWith('refs/heads/')
      ? { kind: 'branch', name: ref.slice('refs/heads/'.length), oid: lines[4] }
      : { kind: 'detached', oid: lines[4] }
  } else {
    const coords = await gateway.read(cwd, COORDS)
    if (coords.unavailable) return { kind: 'unavailable' }
    if (!coords.ok) return { kind: 'not-repo' }
    lines = coords.stdout.trim().split(/\r?\n/)
    const symbolic = await gateway.read(cwd, ['symbolic-ref', '-q', 'HEAD'])
    head = {
      kind: 'unborn',
      name: symbolic.ok ? symbolic.stdout.trim().replace(/^refs\/heads\//, '') || null : null
    }
  }
  if (lines[0] !== 'true' || !lines[1] || !lines[2] || !lines[3]) return { kind: 'not-repo' }
  const [root, gitDir, commonDir] = await Promise.all(
    lines.slice(1, 4).map((path) => canonicalRepoKey(resolve(cwd, path)))
  )
  return { kind: 'repo', root, gitDir, commonDir, head }
}
