import * as fs from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { readArtifactInput } from './files'

vi.mock('node:fs/promises', async (original) => ({
  ...(await original<typeof import('node:fs/promises')>())
}))
const tempFixture = vi.hoisted(() => ({ directory: '' }))
vi.mock('../../infra/config/temp-path', () => ({
  getTemporaryFilesPath: () => tempFixture.directory
}))

const roots: string[] = []
const signal = new AbortController().signal
async function setup(): Promise<{ root: string; cwd: string; temp: string; outside: string }> {
  const root = await fs.realpath(await fs.mkdtemp(join(tmpdir(), 'orca-publish-input-')))
  roots.push(root)
  const cwd = join(root, 'workspace')
  const temp = join(root, 'tmp')
  const outside = join(root, 'outside')
  await fs.mkdir(cwd)
  await fs.mkdir(outside)
  tempFixture.directory = temp
  return { root, cwd, temp, outside }
}

afterEach(async () => {
  vi.restoreAllMocks()
  for (const root of roots.splice(0)) await fs.rm(root, { recursive: true, force: true })
})

describe('artifact publication input roots', () => {
  it.each(['', 'nested/result'])(
    'reads a completed Temp file in %j without extra directories',
    async (child) => {
      const f = await setup()
      const directory = join(f.temp, child)
      await fs.mkdir(directory, { recursive: true })
      const path = join(directory, 'report.md')
      await fs.writeFile(path, '# Temp result')
      const input = await readArtifactInput(path, f.cwd, [], signal)
      expect(input.bytes.toString()).toBe('# Temp result')
      const actual = await fs.realpath(path)
      expect(input.inputSource).toBe(process.platform === 'win32' ? actual.toLowerCase() : actual)
      expect(input.hash).toMatch(/^[a-f0-9]{64}$/)
      expect(await fs.readFile(path, 'utf8')).toBe('# Temp result')
    }
  )

  it('keeps cwd and explicit directories usable when Temp does not exist', async () => {
    const f = await setup()
    await fs.writeFile(join(f.cwd, 'report.md'), '# Workspace')
    await fs.writeFile(join(f.outside, 'report.md'), '# Extra')
    expect((await readArtifactInput('report.md', f.cwd, [], signal)).bytes.toString()).toBe(
      '# Workspace'
    )
    expect(
      (
        await readArtifactInput(join(f.outside, 'report.md'), f.cwd, [f.outside], signal)
      ).bytes.toString()
    ).toBe('# Extra')
    await expect(
      readArtifactInput(join(f.outside, 'report.md'), f.cwd, [], signal)
    ).rejects.toThrow('unsafe-path')
    await expect(fs.stat(f.temp)).rejects.toMatchObject({ code: 'ENOENT' })
  })

  it('rejects Temp siblings and a Temp junction escaping to an outside directory', async () => {
    const f = await setup()
    const sibling = join(f.root, 'tmp-sibling')
    await fs.mkdir(f.temp)
    await fs.mkdir(sibling)
    await fs.writeFile(join(sibling, 'report.md'), '# Sibling')
    await fs.writeFile(join(f.outside, 'report.md'), '# Outside')
    await fs.symlink(f.outside, join(f.temp, 'escape'), 'junction')
    for (const path of [join(sibling, 'report.md'), join(f.temp, 'escape', 'report.md')]) {
      await expect(readArtifactInput(path, f.cwd, [], signal)).rejects.toThrow('unsafe-path')
    }
  })

  it('rejects a Temp resolver that points to a file instead of a directory', async () => {
    const f = await setup()
    await fs.writeFile(f.temp, 'Not a directory')
    await expect(readArtifactInput(f.temp, f.cwd, [], signal)).rejects.toThrow('unsafe-path')
  })

  it.runIf(process.platform === 'win32')(
    'accepts physical Windows short paths for Temp and its file',
    async (context) => {
      const f = await setup()
      await fs.mkdir(f.temp)
      const shortRoot = execFileSync(
        'cmd.exe',
        ['/d', '/u', '/c', 'for %I in (.) do @echo %~fsI'],
        { cwd: f.root, encoding: 'utf16le', windowsHide: true }
      ).trim()
      if (shortRoot.toLowerCase() === f.root.toLowerCase()) {
        context.skip('This filesystem does not create 8.3 directory names')
      }
      tempFixture.directory = join(shortRoot, 'tmp')
      await fs.writeFile(join(f.temp, 'report.md'), '# Short path')
      expect(
        (
          await readArtifactInput(join(tempFixture.directory, 'report.md'), f.cwd, [], signal)
        ).bytes.toString()
      ).toBe('# Short path')
    }
  )

  it.each(['candidate', 'root'] as const)(
    'rejects a %s redirected after reading the Temp file',
    async (position) => {
      const f = await setup()
      await fs.mkdir(f.temp)
      await fs.writeFile(join(f.temp, 'report.md'), '# Original')
      await fs.writeFile(join(f.outside, 'report.md'), '# Replaced')
      const alias = join(f.root, 'temp-alias')
      await fs.symlink(f.temp, alias, 'junction')
      tempFixture.directory = position === 'root' ? alias : f.temp
      const path = join(position === 'candidate' ? alias : f.temp, 'report.md')
      const open = fs.open
      vi.spyOn(fs, 'open').mockImplementationOnce(async (...args) => {
        const handle = await open(...args)
        const close = handle.close.bind(handle)
        vi.spyOn(handle, 'close').mockImplementationOnce(async () => {
          await close()
          await fs.unlink(alias)
          await fs.symlink(f.outside, alias, 'junction')
        })
        return handle
      })
      await expect(readArtifactInput(path, f.cwd, [], signal)).rejects.toThrow('file-changed')
      expect(await fs.readFile(join(f.temp, 'report.md'), 'utf8')).toBe('# Original')
    }
  )
})
