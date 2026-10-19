import { afterEach, describe, expect, it } from 'vitest'
import { mkdtemp, mkdir, writeFile, symlink, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { copyLegacyResources, inspectLegacyResources, resourceManifest } from './legacy-resources'

const roots: string[] = []
async function fixture(): Promise<{ root: string; source: string; target: string }> {
  const root = await mkdtemp(join(tmpdir(), 'orca-resource-test-'))
  roots.push(root)
  const source = join(root, 'source')
  const target = join(root, 'target')
  await mkdir(source)
  await writeFile(join(source, 'object'), 'native object')
  return { root, source, target }
}
afterEach(async () => {
  for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true })
})
describe('OpenCode legacy resource boundaries', () => {
  it('rejects directory links and a snapshot lock before copying', async () => {
    const f = await fixture()
    await symlink(f.source, join(f.root, 'link'), process.platform === 'win32' ? 'junction' : 'dir')
    await expect(resourceManifest(join(f.root, 'link'))).rejects.toThrow('resource-link')
    await writeFile(join(f.source, 'index.lock'), '')
    await expect(resourceManifest(f.source)).rejects.toThrow('snapshot-busy')
  })
  it('refuses a source whose bytes changed since inventory', async () => {
    const f = await fixture()
    const digest = await resourceManifest(f.source)
    await writeFile(join(f.source, 'object'), 'changed')
    await expect(
      copyLegacyResources([{ source: f.source, target: f.target, digest, hashes: [] }])
    ).rejects.toThrow('snapshot-changed')
  })
  it('never replaces an existing empty target directory', async () => {
    const f = await fixture()
    const digest = await resourceManifest(f.source)
    await mkdir(f.target)
    await expect(
      copyLegacyResources([{ source: f.source, target: f.target, digest, hashes: [] }])
    ).rejects.toThrow('snapshot-conflict')
    expect(await resourceManifest(f.target)).not.toBe(digest)
  })
  it('retains same-workspace files and reports a missing referenced file', async () => {
    const f = await fixture()
    const options = {
      raw: [pathToFileURL(join(f.source, 'object')).href],
      legacyRoot: join(f.root, 'legacy'),
      nativeData: f.target,
      projectId: 'global',
      worktree: f.root,
      targetHasProjectSessions: false
    }
    await expect(inspectLegacyResources(options)).resolves.toEqual([])
    await expect(
      inspectLegacyResources({ ...options, raw: [pathToFileURL(join(f.root, 'missing')).href] })
    ).rejects.toThrow('missing-workspace-file')
  })
})
