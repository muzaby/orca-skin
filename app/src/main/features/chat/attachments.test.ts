import { mkdtemp, writeFile, readFile, readdir, rm, symlink, truncate } from 'node:fs/promises'
import { basename, dirname, join, resolve } from 'node:path'
import { createHash } from 'node:crypto'
import { homedir, tmpdir } from 'node:os'
import { afterEach, describe, expect, it } from 'vitest'
import { MAX_FILE_CONTEXT_CHARS, bufferToBase64Chunked, normalizeAttachments } from './attachments'
import { MAX_ATTACHMENT_BYTES, nativeAttachmentDirectory } from './attachment-files'

const createdDirs: string[] = []
const copiedFiles: string[] = []

async function trackTempDir(dir: string): Promise<string> {
  createdDirs.push(dir)
  return dir
}

async function makeTempDir(): Promise<string> {
  return trackTempDir(await mkdtemp(join(tmpdir(), 'orca-attachment-test-')))
}

// normalizeAttachments 경로 첨부는 assertAllowedAttachmentPath 가 홈 하위 경로만
// 허용하므로(보안 검사) 홈 안에 만들 수밖에 없다 — afterEach 가 즉시 정리한다.
async function makeHomeTempDir(): Promise<string> {
  return trackTempDir(await mkdtemp(join(homedir(), '.orca-attachment-test-')))
}

afterEach(async () => {
  await Promise.all(copiedFiles.splice(0).map((file) => rm(file, { force: true })))
  await Promise.all(createdDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
})

describe('attachment files and text normalization', () => {
  it('stores attachments in the OS user temporary directory by default', () => {
    expect(nativeAttachmentDirectory()).toBe(resolve(tmpdir()))
  })
  it('copies file and clipboard input into the actual OS Temp root without touching the source', async () => {
    const source = join(await makeHomeTempDir(), 'reference.md')
    await writeFile(source, '# Source')
    const normalized = await normalizeAttachments(
      [
        {
          kind: 'path',
          path: source,
          name: 'reference.md',
          mimeType: 'text/markdown',
          sourceKind: 'dialog'
        },
        {
          kind: 'inline',
          name: 'clipboard.png',
          mimeType: 'image/png',
          data: Buffer.from('clipboard').toString('base64'),
          sourceKind: 'clipboard'
        }
      ],
      { views: [] }
    )
    for (const view of normalized.attachmentViews ?? []) {
      copiedFiles.push(view.path!)
      expect(dirname(view.path!)).toBe(resolve(tmpdir()))
    }
    expect(normalized.attachmentViews).toHaveLength(2)
    expect(await readFile(normalized.attachmentViews![0].path!, 'utf8')).toBe('# Source')
    expect(await readFile(normalized.attachmentViews![1].path!, 'utf8')).toBe('clipboard')
    expect(await readFile(source, 'utf8')).toBe('# Source')
  })
  it('extracts UTF-8 text and strips BOM', async () => {
    const dir = await makeHomeTempDir()
    const path = join(dir, 'note.md')
    await writeFile(path, '\uFEFFhello')

    const result = await normalizeAttachments([
      { kind: 'path', path, name: 'note.md', mimeType: 'text/markdown', sourceKind: 'dialog' }
    ])
    expect(result.attachmentTexts[0]?.text).toBe('hello')
  })

  it('rejects binary-like text', async () => {
    const dir = await makeHomeTempDir()
    const path = join(dir, 'bad.txt')
    await writeFile(path, Buffer.from([65, 0, 66]))

    await expect(
      normalizeAttachments([
        { kind: 'path', path, name: 'bad.txt', mimeType: 'text/plain', sourceKind: 'dialog' }
      ])
    ).rejects.toThrow('binary-like')
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
    const dir = await makeHomeTempDir()
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

  it('stores dialog, drop and clipboard bytes at unique paths while preserving display views and model data', async () => {
    const source = await makeHomeTempDir()
    const directory = await makeTempDir()
    const path = join(source, 'note.md')
    await writeFile(path, '# Reference')
    const image = Buffer.from('clipboard image bytes')
    const attachments = [
      {
        kind: 'path' as const,
        path,
        name: 'note.md',
        mimeType: 'text/markdown',
        sourceKind: 'dialog' as const
      },
      {
        kind: 'path' as const,
        path,
        name: 'note.md',
        mimeType: 'text/markdown',
        sourceKind: 'drag_drop' as const
      },
      {
        kind: 'inline' as const,
        name: 'note.md',
        mimeType: 'image/png',
        data: image.toString('base64'),
        sourceKind: 'clipboard' as const
      }
    ]
    const views = [
      {
        id: 'original-view',
        name: 'note.md',
        mimeType: 'text/markdown',
        kind: 'file' as const,
        path: '/forged',
        sha256: 'forged'
      }
    ]
    const result = await normalizeAttachments(attachments, { directory, views })
    expect(result.attachmentViews).toHaveLength(3)
    expect(new Set(result.attachmentViews!.map((view) => view.path)).size).toBe(3)
    expect(result.attachmentViews![0]).toMatchObject({ id: 'original-view', name: 'note.md' })
    for (const [index, view] of result.attachmentViews!.entries()) {
      expect(dirname(view.path!)).toBe(directory)
      expect(basename(view.path!)).not.toBe('note.md')
      const bytes = await readFile(view.path!)
      expect(bytes).toEqual(index === 2 ? image : Buffer.from('# Reference'))
      expect(view.sha256).toBe(createHash('sha256').update(bytes).digest('hex'))
    }
    expect(result.attachmentTexts[0]).toMatchObject({
      text: '# Reference',
      path: result.attachmentViews![0].path
    })
    expect(result.attachmentImages[0]).toMatchObject({
      data: image.toString('base64'),
      path: result.attachmentViews![2].path,
      sourceKind: 'clipboard'
    })
    expect(await readFile(path, 'utf8')).toBe('# Reference')
  })

  it('rolls back files from this batch when a later attachment fails', async () => {
    const directory = await makeTempDir()
    await writeFile(join(directory, 'unrelated.txt'), 'keep')
    await expect(
      normalizeAttachments(
        [
          {
            kind: 'inline',
            name: 'paste.png',
            mimeType: 'image/png',
            data: 'YWJj',
            sourceKind: 'clipboard'
          },
          {
            kind: 'inline',
            name: 'bad.txt',
            mimeType: 'text/plain',
            data: 'YWJj',
            sourceKind: 'clipboard'
          }
        ],
        { directory, views: [] }
      )
    ).rejects.toThrow('must be an image')
    expect(await readdir(directory)).toEqual(['unrelated.txt'])
  })

  it('rejects redirected storage roots before writing attachment bytes', async () => {
    const container = await makeTempDir()
    const actual = await makeTempDir()
    const directory = join(container, 'redirect')
    await symlink(actual, directory, process.platform === 'win32' ? 'junction' : 'dir')
    await expect(
      normalizeAttachments(
        [
          {
            kind: 'inline',
            name: 'paste.png',
            mimeType: 'image/png',
            data: 'YWJj',
            sourceKind: 'clipboard'
          }
        ],
        { directory, views: [] }
      )
    ).rejects.toThrow('unsafe attachment directory')
    expect(await readdir(actual)).toEqual([])
  })

  it('bounds actual file bytes regardless of the advertised size and rejects malformed clipboard data', async () => {
    const source = await makeHomeTempDir()
    const directory = await makeTempDir()
    const path = join(source, 'large.txt')
    await writeFile(path, '')
    await truncate(path, MAX_ATTACHMENT_BYTES + 1)
    await expect(
      normalizeAttachments(
        [
          {
            kind: 'path',
            path,
            name: 'large.txt',
            mimeType: 'text/plain',
            sizeBytes: 1,
            sourceKind: 'drag_drop'
          }
        ],
        { directory, views: [] }
      )
    ).rejects.toThrow('32 MiB')
    await expect(
      normalizeAttachments(
        [
          {
            kind: 'inline',
            name: 'paste.png',
            mimeType: 'image/png',
            data: 'not base64!?',
            sourceKind: 'clipboard'
          }
        ],
        { directory, views: [] }
      )
    ).rejects.toThrow('base64')
    expect(await readdir(directory)).toEqual([])
  })
})

// 0110 — 청크 인코딩은 단일 toString('base64') 와 결과가 바이트 동일해야 한다(패딩 경계 3의 배수).
describe('bufferToBase64Chunked', () => {
  it('청크 경계·비정렬 chunkBytes·소형 버퍼 모두 단일 인코딩과 동치', async () => {
    const sizes = [0, 1, 2, 3, 4, 5, 6, 7, 100, 1024, 3 * 1024 + 1]
    for (const size of sizes) {
      const buf = Buffer.from(Array.from({ length: size }, (_, i) => (i * 7 + 13) % 256))
      const expected = buf.toString('base64')
      // 3의 배수 / 비정렬(내부에서 3의 배수로 내림) / 최소값 미만(3으로 클램프) 청크 크기.
      for (const chunk of [3, 4, 5, 64, 1, 2]) {
        expect(await bufferToBase64Chunked(buf, chunk)).toBe(expected)
      }
    }
  })

  it('기본 청크(3MiB)보다 작은 버퍼는 단일 패스로 인코딩한다', async () => {
    const buf = Buffer.from('hello world')
    expect(await bufferToBase64Chunked(buf)).toBe(buf.toString('base64'))
  })
})
