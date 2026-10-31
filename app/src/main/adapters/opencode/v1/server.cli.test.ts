import { expect, it, vi } from 'vitest'
const execute = vi.hoisted(() => vi.fn())
vi.mock('node:child_process', async (original) => ({
  ...(await original<typeof import('node:child_process')>()),
  execFile: execute
}))
import { OpenCodeServerPool } from './server'

it('probes the installed version through the shared CLI runner with version arguments and limits', async () => {
  execute.mockImplementation((_file, _args, _options, callback) => {
    queueMicrotask(() => callback(null, ' 1.19.0\n'))
  })
  const pool = new OpenCodeServerPool({
    dataDirectory: process.cwd(),
    preferences: () => ({ instructions: '', executablePath: '' }),
    executable: () => 'opencode'
  })
  try {
    expect(await pool.installed()).toMatchObject({ version: '1.19.0' })
    expect(execute).toHaveBeenCalledWith(
      'opencode',
      ['--version'],
      expect.objectContaining({ windowsHide: true, timeout: 15000, encoding: 'utf8' }),
      expect.any(Function)
    )
  } finally {
    pool.close()
  }
})
