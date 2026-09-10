import { realpath } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { expect, it } from 'vitest'
import { getTemporaryFilesPath } from '../../infra/config/temp-path'
import { prepareOutputDirectory } from './files'

it('uses the real OS temporary root for outputs across workspace drives', async () => {
  const expected = await realpath(tmpdir())
  expect(getTemporaryFilesPath()).toBe(resolve(tmpdir()))
  expect(await prepareOutputDirectory(resolve('workspace'))).toBe(expected)
  if (process.platform === 'win32') {
    expect(await prepareOutputDirectory('Z:\\another-workspace')).toBe(expected)
    expect(getTemporaryFilesPath().toLowerCase()).not.toBe('c:\\tmp')
  }
})
