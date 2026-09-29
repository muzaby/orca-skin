import { mkdir, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { archiveSourceId } from './identity'
import { collectEmlFiles, resolveImportSources, sourceKindForPath } from './sources'

const roots: string[] = []

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
})

async function tempRoot(): Promise<string> {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'orca-mail-archive-')))
  roots.push(root)
  return root
}

describe('mail archive source selection', () => {
  it('recognises supported extensions without accepting attachment files', () => {
    expect(sourceKindForPath('mail.EML')).toBe('eml')
    expect(sourceKindForPath('archive.Pst')).toBe('pst')
    expect(sourceKindForPath('notes.txt')).toBeNull()
  })

  it('treats an EML folder as one source keyed by relative file paths', async () => {
    const root = await tempRoot()
    await mkdir(join(root, 'nested'))
    await writeFile(join(root, 'b.eml'), 'b')
    await writeFile(join(root, 'nested', 'a.eml'), 'a')
    await writeFile(join(root, 'nested', 'skip.txt'), 'skip')

    expect(await collectEmlFiles(root)).toEqual([
      join(root, 'b.eml'),
      join(root, 'nested', 'a.eml')
    ])
    expect(await resolveImportSources({ inputKind: 'eml-folder', paths: [root] })).toEqual([
      {
        sourceId: archiveSourceId('eml', root),
        kind: 'eml',
        root,
        files: [
          { path: join(root, 'b.eml'), itemKey: 'b.eml' },
          { path: join(root, 'nested', 'a.eml'), itemKey: 'nested/a.eml' }
        ]
      }
    ])
  })

  it('makes each picked file its own source and rejects an empty EML folder', async () => {
    const root = await tempRoot()
    await writeFile(join(root, 'mail.pst'), 'not a pst')
    await expect(
      resolveImportSources({ inputKind: 'files', paths: [join(root, 'mail.pst')] })
    ).resolves.toEqual([
      {
        sourceId: archiveSourceId('pst', join(root, 'mail.pst')),
        kind: 'pst',
        root: join(root, 'mail.pst'),
        files: [{ path: join(root, 'mail.pst'), itemKey: '' }]
      }
    ])
    await expect(resolveImportSources({ inputKind: 'eml-folder', paths: [root] })).rejects.toThrow(
      'eml_folder_empty'
    )
  })
})
