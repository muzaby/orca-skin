import { mkdtempSync, mkdirSync, writeFileSync, rmSync, promises as fs } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { opensWithDefaultApp, resolveContextFile, type ContextFileScope } from './context-file'

describe('context file extension policy', () => {
  it.each([
    'pdf',
    'docx',
    'xlsx',
    'pptx',
    'png',
    'jpg',
    'jpeg',
    'gif',
    'bmp',
    'webp',
    'tif',
    'tiff',
    'txt',
    'md',
    'markdown',
    'log',
    'csv',
    'tsv',
    'json',
    'jsonl',
    'xml',
    'yaml',
    'yml'
  ])('opens the allowed %s format and its uppercase spelling', (extension) => {
    expect(opensWithDefaultApp(`/work/report.${extension}`)).toBe(true)
    expect(opensWithDefaultApp(`/work/report.${extension.toUpperCase()}`)).toBe(true)
  })
  it.each([
    'a.exe',
    'a.bat',
    'a.cmd',
    'a.ps1',
    'a.py',
    'a.js',
    'a.lnk',
    'a.html',
    'a.svg',
    'a.docm',
    'a.xls',
    'a.rtf',
    'README',
    'a.pdf.',
    'a.txt:b.exe'
  ])('reveals unsupported %s without running a default app', (name) => {
    expect(opensWithDefaultApp(`/work/${name}`)).toBe(false)
  })
})

describe('context file existence before canonical resolution', () => {
  let root: string
  let cwd: string
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'orca-context-file-'))
    cwd = join(root, 'work')
    mkdirSync(cwd)
  })
  afterEach(() => {
    vi.restoreAllMocks()
    rmSync(root, { recursive: true, force: true })
  })
  const scope = (): ContextFileScope => ({
    recordedContextDirectories: () => [cwd],
    recordedAttachmentFiles: () => []
  })
  it('returns missing for an approved absent path without invoking realpath', async () => {
    const realpath = vi.spyOn(fs, 'realpath')
    await expect(resolveContextFile(scope(), 'work', join(cwd, 'gone.md'))).resolves.toEqual({
      state: 'missing'
    })
    expect(realpath).not.toHaveBeenCalled()
  })
  it('does not disclose whether an unapproved path is absent', async () => {
    await expect(resolveContextFile(scope(), 'work', join(root, 'outside.md'))).rejects.toThrow(
      '허용되지 않은'
    )
  })
  it('treats an approved path below a replaced file as missing (ENOTDIR)', async () => {
    const file = join(cwd, 'gone-parent')
    writeFileSync(file, 'file')
    await expect(resolveContextFile(scope(), 'work', join(file, 'gone.md'))).resolves.toEqual({
      state: 'missing'
    })
  })
  it('rejects directories and propagates other filesystem errors', async () => {
    await expect(resolveContextFile(scope(), 'work', cwd)).rejects.toThrow('파일만')
    const error = Object.assign(new Error('IO failure'), { code: 'EACCES' })
    vi.spyOn(fs, 'stat').mockRejectedValueOnce(error)
    await expect(resolveContextFile(scope(), 'work', join(cwd, 'a.md'))).rejects.toBe(error)
  })
})
