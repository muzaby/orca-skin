import { createHash, randomUUID } from 'node:crypto'
import { promises as fs } from 'node:fs'
import { join, relative, resolve, isAbsolute, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { gitGateway } from '../../../infra/git/gateway'
import { sameNativePath } from './native-storage'

export class MigrationBlocked extends Error {
  constructor(
    readonly reason: string,
    readonly busy = false
  ) {
    super(
      'OpenCode 기존 세션 전환을 완료하지 못했습니다 (' + reason + '). 원본은 보존되어 있습니다.'
    )
  }
}
export interface ResourceCopy {
  source: string
  target: string
  digest: string
  hashes: string[]
}
function within(root: string, path: string): boolean {
  const rel = relative(root, path)
  return !rel.startsWith('..') && !isAbsolute(rel)
}
export async function resourceManifest(root: string): Promise<string> {
  const entries: Array<[string, number, string]> = []
  const visit = async (path: string): Promise<void> => {
    const stat = await fs.lstat(path)
    if (stat.isSymbolicLink()) throw new MigrationBlocked('resource-link')
    if (stat.isDirectory()) {
      for (const name of (await fs.readdir(path)).sort()) await visit(join(path, name))
    } else if (stat.isFile()) {
      if (path.endsWith('.lock')) throw new MigrationBlocked('snapshot-busy', true)
      const bytes = await fs.readFile(path)
      entries.push([
        relative(root, path).replaceAll('\\', '/'),
        bytes.length,
        createHash('sha256').update(bytes).digest('hex')
      ])
    } else throw new MigrationBlocked('resource-type')
  }
  await visit(root)
  return createHash('sha256').update(JSON.stringify(entries)).digest('hex')
}
async function exists(path: string): Promise<boolean> {
  try {
    await fs.access(path)
    return true
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false
    throw error
  }
}
export async function inspectLegacyResources(options: {
  raw: unknown[]
  legacyRoot: string
  nativeData: string
  projectId: string
  worktree: string
  targetHasProjectSessions: boolean
}): Promise<ResourceCopy[]> {
  const { raw, legacyRoot, nativeData, projectId, worktree } = options
  const oldRoot = resolve(legacyRoot).replaceAll('\\', '/').toLowerCase()
  const hashes = new Set<string>()
  const worktrees = new Set<string>()
  const check = async (value: unknown, key?: string): Promise<void> => {
    if (typeof value === 'string') {
      if (key === 'snapshot' && /^[a-f0-9]{40,64}$/.test(value)) hashes.add(value)
      if (value.replaceAll('\\', '/').toLowerCase().includes(oldRoot))
        throw new MigrationBlocked(
          value.includes('tool-output') ? 'tool-output-reference' : 'legacy-resource-reference'
        )
      if (value.startsWith('file://')) {
        if (!(await exists(fileURLToPath(value))))
          throw new MigrationBlocked('missing-workspace-file')
      }
      return
    }
    if (Array.isArray(value)) {
      for (const item of value) await check(item)
    } else if (value && typeof value === 'object') {
      if (
        'role' in value &&
        value.role === 'assistant' &&
        'path' in value &&
        value.path &&
        typeof value.path === 'object' &&
        'root' in value.path &&
        typeof value.path.root === 'string'
      )
        worktrees.add(value.path.root)
      if (
        'type' in value &&
        value.type === 'patch' &&
        'hash' in value &&
        typeof value.hash === 'string' &&
        /^[a-f0-9]{40,64}$/.test(value.hash)
      )
        hashes.add(value.hash)
      for (const [name, item] of Object.entries(value)) await check(item, name)
    }
  }
  await check(raw)
  if (!hashes.size) return []
  if ([...worktrees].some((root) => !sameNativePath(root, worktree)))
    throw new MigrationBlocked('snapshot-worktree')
  if (!/^[\w-]+$/.test(projectId)) throw new MigrationBlocked('project-identity')
  const suffix = join('snapshot', projectId, createHash('sha1').update(worktree).digest('hex'))
  const source = join(legacyRoot, 'data', 'opencode', suffix)
  const target = join(nativeData, suffix)
  if (!(await exists(source))) throw new MigrationBlocked('missing-snapshot')
  const alternates = join(source, 'objects', 'info', 'alternates')
  if (await exists(alternates)) {
    for (const value of (await fs.readFile(alternates, 'utf8')).split(/\r?\n/).filter(Boolean)) {
      const path = resolve(source, 'objects', value)
      if (!within(worktree, path) || !(await exists(path)))
        throw new MigrationBlocked('snapshot-alternates')
    }
  }
  for (const hash of hashes) {
    const result = await gitGateway.read(
      worktree,
      ['--git-dir=' + source, 'cat-file', '-e', hash],
      { timeoutMs: 30000 }
    )
    if (!result.ok) throw new MigrationBlocked('snapshot-object')
  }
  const digest = await resourceManifest(source)
  if (await exists(target)) {
    if ((await resourceManifest(target)) !== digest) throw new MigrationBlocked('snapshot-conflict')
  } else if (options.targetHasProjectSessions) throw new MigrationBlocked('snapshot-project-active')
  return [{ source, target, digest, hashes: [...hashes] }]
}
export async function copyLegacyResources(resources: ResourceCopy[]): Promise<void> {
  for (const resource of resources) {
    if ((await resourceManifest(resource.source)) !== resource.digest)
      throw new MigrationBlocked('snapshot-changed', true)
    if (await exists(resource.target)) {
      if ((await resourceManifest(resource.target)) !== resource.digest)
        throw new MigrationBlocked('snapshot-conflict')
      continue
    }
    await fs.mkdir(dirname(resource.target), { recursive: true })
    const temp = resource.target + '.orca-' + randomUUID()
    try {
      await fs.cp(resource.source, temp, { recursive: true, force: false, errorOnExist: true })
      if (
        (await resourceManifest(temp)) !== resource.digest ||
        (await resourceManifest(resource.source)) !== resource.digest
      )
        throw new MigrationBlocked('snapshot-changed', true)
      if (await exists(resource.target)) throw new MigrationBlocked('snapshot-conflict')
      // On supported Windows, directory rename refuses even an existing empty directory.
      await fs.rename(temp, resource.target)
    } finally {
      // Only this unique staging path belongs to us. Published resources remain recoverable.
      await fs.rm(temp, { recursive: true, force: true })
    }
  }
}
export async function verifyLegacyResources(resources: ResourceCopy[]): Promise<void> {
  for (const resource of resources)
    if (
      (await resourceManifest(resource.source)) !== resource.digest ||
      (await resourceManifest(resource.target)) !== resource.digest
    )
      throw new MigrationBlocked('snapshot-changed', true)
}
