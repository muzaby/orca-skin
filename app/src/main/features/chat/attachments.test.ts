import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { homedir, tmpdir } from 'node:os'
import { afterEach, describe, expect, it } from 'vitest'
import {
  MAX_FILE_CONTEXT_CHARS,
  TextExtractor,
  bufferToBase64Chunked,
  normalizeAttachments
} from './attachments'

const createdDirs: string[] = []

async function trackTempDir(dir: string): Promise<string> {
  createdDirs.push(dir)
  return dir
}

// TextExtractor 는 홈-경계 검사를 거치지 않으므로 OS 임시 디렉토리를 쓴다.
async function makeTempDir(): Promise<string> {
  return trackTempDir(await mkdtemp(join(tmpdir(), 'orca-attachment-test-')))
}

// normalizeAttachments 경로 첨부는 assertAllowedAttachmentPath 가 홈 하위 경로만
// 허용하므로(보안 검사) 홈 안에 만들 수밖에 없다 — afterEach 가 즉시 정리한다.
async function makeHomeTempDir(): Promise<string> {
  return trackTempDir(await mkdtemp(join(homedir(), '.orca-attachment-test-')))
}

afterEach(async () => {
  await Promise.all(createdDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
})

describe('TextExtractor', () => {
  it('extracts UTF-8 text and strips BOM', async () => {
    const dir = await makeTempDir()
    const path = join(dir, 'note.md')
    await writeFile(path, '\uFEFFhello')

    await expect(new TextExtractor().extract(path)).resolves.toBe('hello')
  })

  it('rejects binary-like text', async () => {
    const dir = await makeTempDir()
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
