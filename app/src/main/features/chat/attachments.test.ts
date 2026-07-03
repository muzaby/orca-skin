import { mkdtemp, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { homedir } from 'node:os'
import { describe, expect, it } from 'vitest'
import { MAX_FILE_CONTEXT_CHARS, TextExtractor, normalizeAttachments } from './attachments'

describe('TextExtractor', () => {
  it('extracts UTF-8 text and strips BOM', async () => {
    const dir = await mkdtemp(join(homedir(), '.orca-attachment-test-'))
    const path = join(dir, 'note.md')
    await writeFile(path, '\uFEFFhello')

    await expect(new TextExtractor().extract(path)).resolves.toBe('hello')
  })

  it('rejects binary-like text', async () => {
    const dir = await mkdtemp(join(homedir(), '.orca-attachment-test-'))
    const path = join(dir, 'bad.txt')
    await writeFile(path, Buffer.from([65, 0, 66]))

    await expect(new TextExtractor().extract(path)).rejects.toThrow('binary-like')
  })
})

describe('normalizeAttachments', () => {
  it('normalizes inline image data by stripping data URL prefix', async () => {
    const result = await normalizeAttachments([
      {
        kind: 'inline',
        name: 'paste.png',
        mimeType: 'image/png',
        data: 'data:image/png;base64,abc123',
        sourceKind: 'clipboard'
      }
    ])

    expect(result.attachmentImages[0]).toMatchObject({ data: 'abc123', sourceKind: 'clipboard' })
  })

  it('truncates oversized path text attachments', async () => {
    const dir = await mkdtemp(join(homedir(), '.orca-attachment-test-'))
    const path = join(dir, 'large.txt')
    await writeFile(path, 'a'.repeat(MAX_FILE_CONTEXT_CHARS + 10))

    const result = await normalizeAttachments([
      {
        kind: 'path',
        path,
        name: 'large.txt',
        mimeType: 'text/plain',
        sourceKind: 'dialog'
      }
    ])

    expect(result.attachmentTexts[0]?.truncated).toBe(true)
    expect(result.attachmentTexts[0]?.charsIncluded).toBe(MAX_FILE_CONTEXT_CHARS)
  })
})
