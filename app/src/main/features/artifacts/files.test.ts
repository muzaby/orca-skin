import * as fs from 'node:fs/promises'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { readStableFile } from './files'

vi.mock('node:fs/promises', async (original) => ({
  ...(await original<typeof import('node:fs/promises')>())
}))

const roots: string[] = []
afterEach(async () => {
  vi.restoreAllMocks()
  for (const root of roots.splice(0)) await fs.rm(root, { recursive: true, force: true })
})

describe('bounded file-handle publication reads', () => {
  it('rejects a real file modified after opening instead of publishing mixed bytes', async () => {
    const root = await fs.mkdtemp(join(tmpdir(), 'orca-artifact-read-'))
    roots.push(root)
    const path = join(root, 'report.md')
    await fs.writeFile(path, 'Original')
    const open = fs.open
    vi.spyOn(fs, 'open').mockImplementationOnce(async (...args) => {
      const handle = await open(...args)
      const read = handle.read
      vi.spyOn(handle, 'read').mockImplementationOnce((...readArgs) => {
        writeFileSync(path, 'Changed after opening')
        return Reflect.apply(read, handle, readArgs) as ReturnType<typeof read>
      })
      return handle
    })
    await expect(readStableFile(path)).rejects.toThrow('file-changed')
    expect(await fs.readFile(path, 'utf8')).toBe('Changed after opening')
  })

  it('closes its handle when reading fails and reports no partial successful buffer', async () => {
    const root = await fs.mkdtemp(join(tmpdir(), 'orca-artifact-read-'))
    roots.push(root)
    const path = join(root, 'report.md')
    await fs.writeFile(path, 'Original')
    const open = fs.open
    const closed = vi.fn()
    vi.spyOn(fs, 'open').mockImplementationOnce(async (...args) => {
      const handle = await open(...args)
      const close = handle.close.bind(handle)
      vi.spyOn(handle, 'read').mockRejectedValueOnce(
        Object.assign(new Error('injected'), { code: 'EIO' })
      )
      vi.spyOn(handle, 'close').mockImplementation(async () => {
        await close()
        closed()
      })
      return handle
    })
    await expect(readStableFile(path)).rejects.toThrow('injected')
    expect(closed).toHaveBeenCalledOnce()
  })
})
