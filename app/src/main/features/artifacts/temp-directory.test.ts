import { mkdtemp, realpath, rm, symlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { PRODUCT_SLUG } from '../../../shared/product'
import { afterEach, expect, it } from 'vitest'
import { getTemporaryFilesPath, prepareTemporaryFilesPath } from '../../infra/config/temp-path'
import { prepareOutputDirectory } from './files'

const roots: string[] = []

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
})

it('uses the product child of the real OS temporary root across workspace drives', async () => {
  expect(getTemporaryFilesPath()).toBe(resolve(tmpdir(), PRODUCT_SLUG))
  const prepared = await prepareOutputDirectory(resolve('workspace'))
  const expected = await realpath(join(tmpdir(), PRODUCT_SLUG))
  expect(prepared).toBe(expected)
  if (process.platform === 'win32') {
    expect(await prepareOutputDirectory('Z:\\another-workspace')).toBe(expected)
    expect(getTemporaryFilesPath().toLowerCase()).not.toBe('c:\\tmp')
  }
})

it('creates the product child under an injected OS temporary root', async () => {
  const root = await mkdtemp(join(tmpdir(), 'orca-temp-policy-'))
  roots.push(root)
  const expected = join(root, PRODUCT_SLUG)

  expect(await prepareTemporaryFilesPath(root)).toBe(await realpath(expected))
  expect(dirname(getTemporaryFilesPath(root))).toBe(resolve(root))
})

it('rejects a redirected OS temporary parent before preparing the product child', async () => {
  const root = await mkdtemp(join(tmpdir(), 'orca-temp-policy-'))
  const target = await mkdtemp(join(tmpdir(), 'orca-temp-target-'))
  roots.push(root, target)
  const alias = join(root, 'redirected')
  await symlink(target, alias, process.platform === 'win32' ? 'junction' : 'dir')

  await expect(prepareTemporaryFilesPath(alias)).rejects.toThrow('unsafe temporary directory')
})
