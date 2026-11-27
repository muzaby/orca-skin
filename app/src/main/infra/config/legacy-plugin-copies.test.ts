import { mkdtemp, mkdir, writeFile, readFile, symlink, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, it } from 'vitest'
import { cleanupLegacyPluginCopies } from './legacy-plugin-copies'

it('removes only direct legacy generations without following the base or nested junctions', async () => {
  const root = await mkdtemp(join(tmpdir(), 'oo-old-copies-'))
  try {
    const source = join(root, 'installation')
    const base = join(root, 'runtime-plugins')
    await cleanupLegacyPluginCopies(root)
    expect(await readdir(root)).toEqual([])
    await mkdir(join(source, 'generation-original'), { recursive: true })
    await writeFile(join(source, 'generation-original', 'sentinel'), 'kept')
    await symlink(source, base, 'junction')
    await cleanupLegacyPluginCopies(root)
    expect(await readdir(source)).toEqual(['generation-original'])
    await rm(base, { recursive: true })
    await mkdir(join(base, 'generation-old'), { recursive: true })
    await mkdir(join(base, 'other'))
    await symlink(source, join(base, 'generation-old', 'wrapper'), 'junction')
    await cleanupLegacyPluginCopies(root)
    expect(await readdir(base)).toEqual(['other'])
    expect(await readFile(join(source, 'generation-original', 'sentinel'), 'utf8')).toBe('kept')
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
