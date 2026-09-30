import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { collectEmlFiles, resolveImportSources, sourceKindForPath } from './sources'

const roots: string[] = []

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
})

describe('mail archive source selection', () => {
  it('recognises supported extensions without accepting attachment files', () => {
    expect(sourceKindForPath('mail.EML')).toBe('eml')
    expect(sourceKindForPath('archive.Pst')).toBe('pst')
    expect(sourceKindForPath('notes.txt')).toBeNull()
  })

  it('walks an EML folder recursively in stable order', async () => {
    const root = await mkdtemp(join(tmpdir(), 'orca-mail-archive-'))
    roots.push(root)
    await mkdir(join(root, 'nested'))
    await writeFile(join(root, 'b.eml'), 'b')
    await writeFile(join(root, 'nested', 'a.eml'), 'a')
    await writeFile(join(root, 'nested', 'skip.txt'), 'skip')
    const files = await collectEmlFiles(root)
    expect(files.map((file) => file.path)).toEqual([
      join(root, 'b.eml'),
      join(root, 'nested', 'a.eml')
    ])
  })

  it('rejects a PST in the EML folder mode', async () => {
    const root = await mkdtemp(join(tmpdir(), 'orca-mail-archive-'))
    roots.push(root)
    await writeFile(join(root, 'mail.pst'), 'not a pst')
    expect(await collectEmlFiles(root)).toEqual([])
    await expect(resolveImportSources('files', [join(root, 'mail.pst')])).resolves.toEqual([
      { path: join(root, 'mail.pst'), kind: 'pst' }
    ])
  })
})
