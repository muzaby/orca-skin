import { tmpdir } from 'node:os'
import { lstat, mkdir, realpath } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { PRODUCT_SLUG } from '../../../shared/product'

// Inputs, automatic file-tool access and ordinary outputs share one product child of the
// OS user's temporary directory. The parent still follows the host OS override.
export const getTemporaryFilesPath = (osTemporaryRoot = tmpdir()): string =>
  resolve(osTemporaryRoot, PRODUCT_SLUG)

async function plainDirectory(directory: string): Promise<string> {
  let current = resolve(directory)
  for (;;) {
    const info = await lstat(current)
    if (!info.isDirectory() || info.isSymbolicLink()) {
      throw new Error('unsafe temporary directory')
    }
    const parent = dirname(current)
    if (parent === current) break
    current = parent
  }
  return realpath(directory)
}

export async function prepareTemporaryFilesPath(osTemporaryRoot = tmpdir()): Promise<string> {
  const parent = resolve(osTemporaryRoot)
  await plainDirectory(parent)
  const directory = getTemporaryFilesPath(parent)
  try {
    await mkdir(directory, { mode: 0o700 })
  } catch (error) {
    if (!(error && typeof error === 'object' && 'code' in error && error.code === 'EEXIST')) {
      throw error
    }
  }
  return plainDirectory(directory)
}
