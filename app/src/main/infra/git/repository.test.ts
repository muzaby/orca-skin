import { execFile } from 'node:child_process'
import { mkdtemp, mkdir, realpath, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { afterEach, describe, expect, it } from 'vitest'
import { resolveRepoRoot } from './repository'

const exec = promisify(execFile)
const roots: string[] = []
afterEach(async () =>
  Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
)

describe('resolveRepoRoot', () => {
  it('canonicalizes the root returned from a nested repository cwd', async () => {
    const root = await mkdtemp(join(tmpdir(), 'orca-repository-test-'))
    roots.push(root)
    await exec('git', ['init', root])
    const nested = join(root, 'packages', 'web')
    await mkdir(nested, { recursive: true })
    expect(await resolveRepoRoot(nested)).toBe(await realpath(root))
  })
})
