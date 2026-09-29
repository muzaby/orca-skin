import { createHash } from 'node:crypto'
import { mkdtemp, readFile, rm, unlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { extractMailArchiveAttachment } from './attachment-extract'
import { readEmlFile } from './eml'

const roots: string[] = []
const temporaryFiles: string[] = []
afterEach(async () => {
  await Promise.all(temporaryFiles.splice(0).map((path) => unlink(path).catch(() => undefined)))
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
})

function eml(content = 'CONFIDENTIAL-ATTACHMENT-CONTENT'): string {
  return [
    'From: sender@example.test',
    'To: team@example.test',
    'Subject: 선택 추출 fixture',
    'Message-ID: <extract@example.test>',
    'MIME-Version: 1.0',
    'Content-Type: multipart/mixed; boundary="extract-boundary"',
    '',
    '--extract-boundary',
    'Content-Type: text/plain; charset=utf-8',
    '',
    '메일 본문에는 첨부의 비밀 문구가 없습니다.',
    '--extract-boundary',
    'Content-Type: text/plain; name="other.txt"',
    'Content-Disposition: attachment; filename="other.txt"',
    '',
    'DO-NOT-EXPORT-THIS-ATTACHMENT',
    '--extract-boundary',
    'Content-Type: text/plain; name="plan.txt"',
    'Content-Disposition: attachment; filename="plan.txt"',
    '',
    content,
    '--extract-boundary--',
    ''
  ].join('\r\n')
}

describe('mail archive attachment extraction', () => {
  it('extracts only the selected EML attachment and validates the source revision', async () => {
    const root = await mkdtemp(join(tmpdir(), 'orca-mail-archive-attachment-'))
    roots.push(root)
    const sourcePath = join(root, 'mail.eml')
    const destinationPath = join(root, 'selected.txt')
    const sourceBytes = Buffer.from(eml())
    await writeFile(sourcePath, sourceBytes)
    const sourceFingerprint = createHash('sha256').update(sourceBytes).digest('hex')
    const source = await readEmlFile(sourcePath, 'test-source', sourceFingerprint)
    expect(source.bodyText).not.toContain('CONFIDENTIAL-ATTACHMENT-CONTENT')
    const attachmentIndex = 1
    const attachment = source.attachments[attachmentIndex]!

    const extracted = await extractMailArchiveAttachment(
      {
        attachmentId: 'attachment-test',
        sourceId: 'test-source',
        sourceKind: 'eml',
        sourcePath,
        sourceFingerprint,
        itemKey: source.itemKey,
        attachmentIndex,
        name: attachment.name,
        mimeType: attachment.mimeType,
        sizeBytes: attachment.sizeBytes,
        destinationPath
      },
      new AbortController().signal
    )
    temporaryFiles.push(extracted.temporaryPath)
    expect(extracted.bytesWritten).toBe(attachment.sizeBytes)
    expect(await readFile(extracted.temporaryPath, 'utf8')).toBe(
      'CONFIDENTIAL-ATTACHMENT-CONTENT\n'
    )

    await writeFile(sourcePath, eml('CHANGED-ATTACHMENT-CONTENT'))
    await expect(
      extractMailArchiveAttachment(
        {
          attachmentId: 'attachment-test',
          sourceId: 'test-source',
          sourceKind: 'eml',
          sourcePath,
          sourceFingerprint,
          itemKey: source.itemKey,
          attachmentIndex,
          name: attachment.name,
          mimeType: attachment.mimeType,
          sizeBytes: attachment.sizeBytes,
          destinationPath
        },
        new AbortController().signal
      )
    ).rejects.toThrow('mail_attachment_source_changed')
  })
})
