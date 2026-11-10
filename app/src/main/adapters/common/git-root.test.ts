import { mkdirSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { expect, it } from 'vitest'
import { gitRootLineage, gitRootSync } from './git-root'

it('finds the nearest Git ancestor through three nested directories and falls back to cwd', async () => {
  const root = mkdtempSync(join(tmpdir(), 'orcinus-orca-git-root-'))
  const nested = join(root, 'a', 'b', 'c')
  mkdirSync(nested, { recursive: true })
  try {
    expect(gitRootSync(nested)).toBe(resolve(nested))
    expect((await gitRootLineage(nested)).root).toBe(resolve(nested))
    mkdirSync(join(root, '.git'))
    expect(gitRootSync(nested)).toBe(root)
    expect(await gitRootLineage(nested)).toEqual({
      root,
      directories: [nested, join(root, 'a', 'b'), join(root, 'a'), root]
    })
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

it('propagates errors other than a missing Git marker', async () => {
  const denied = Object.assign(new Error('denied'), { code: 'EACCES' })
  await expect(
    gitRootLineage('/work', async () => {
      throw denied
    })
  ).rejects.toBe(denied)
})
