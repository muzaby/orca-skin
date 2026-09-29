import { randomUUID } from 'node:crypto'
import { open, unlink, writeFile } from 'node:fs/promises'
import { basename, dirname, join, resolve } from 'node:path'
import PostalMime from 'postal-mime'
import type { PSTAttachment } from 'pst-extractor'
import type { MailArchiveAttachmentExportInput, MailArchiveAttachmentExportOutput } from '../types'
import { readEmlBytes } from './eml'
import { bufferFingerprint, fileFingerprint } from './fingerprint'
import { openPst, walkPstMessages, type PstWalkReport } from './pst'

function temporaryPath(destinationPath: string): string {
  return join(
    dirname(resolve(destinationPath)),
    `.${basename(destinationPath)}.${randomUUID()}.orca-part`
  )
}

function assertManifest(
  actual: { name: string; mimeType: string; sizeBytes: number },
  expected: MailArchiveAttachmentExportInput
): void {
  if (
    actual.name !== expected.name ||
    actual.mimeType !== expected.mimeType ||
    actual.sizeBytes !== expected.sizeBytes
  ) {
    throw new Error('mail_attachment_source_changed')
  }
}

/** 지문이 같은 바이트에서 바로 꺼내므로 이후 원본이 바뀌어도 결과는 보관 당시의 첨부다. */
async function extractEmlAttachment(
  input: MailArchiveAttachmentExportInput,
  signal: AbortSignal
): Promise<MailArchiveAttachmentExportOutput> {
  const raw = await readEmlBytes(input.sourcePath)
  signal.throwIfAborted()
  if (bufferFingerprint(raw) !== input.sourceFingerprint) {
    throw new Error('mail_attachment_source_changed')
  }
  const email = await PostalMime.parse(raw, { forceRfc822Attachments: true })
  signal.throwIfAborted()
  const attachment = email.attachments?.[input.attachmentIndex]
  if (!attachment) throw new Error('mail_attachment_not_found')
  const content = attachment.content
  const bytes =
    typeof content === 'string'
      ? Buffer.from(content, 'utf8')
      : Buffer.from(new Uint8Array(content))
  assertManifest(
    {
      name: attachment.filename?.trim() || 'attachment',
      mimeType: attachment.mimeType?.trim() || 'application/octet-stream',
      sizeBytes: bytes.byteLength
    },
    input
  )
  const target = temporaryPath(input.destinationPath)
  await writeFile(target, bytes, { flag: 'wx' })
  return { temporaryPath: target, bytesWritten: bytes.byteLength }
}

async function writePstAttachment(
  attachment: PSTAttachment,
  path: string,
  signal: AbortSignal
): Promise<number> {
  const stream = attachment.fileInputStream
  if (!stream) {
    if (attachment.filesize === 0 || attachment.size === 0) {
      await writeFile(path, Buffer.alloc(0), { flag: 'wx' })
      return 0
    }
    throw new Error('mail_attachment_content_unavailable')
  }
  const file = await open(path, 'wx')
  const buffer = Buffer.alloc(64 * 1024)
  let bytesWritten = 0
  try {
    for (;;) {
      signal.throwIfAborted()
      const bytesRead = stream.read(buffer)
      if (bytesRead <= 0) break
      let offset = 0
      while (offset < bytesRead) {
        const written = await file.write(buffer, offset, bytesRead - offset)
        if (written.bytesWritten <= 0) throw new Error('mail_attachment_write_failed')
        offset += written.bytesWritten
      }
      bytesWritten += bytesRead
    }
    await file.sync()
    return bytesWritten
  } finally {
    await file.close()
  }
}

/** PST는 추출 중에도 디스크에서 읽으므로 앞뒤 지문을 모두 확인한다. */
async function extractPstAttachment(
  input: MailArchiveAttachmentExportInput,
  signal: AbortSignal
): Promise<MailArchiveAttachmentExportOutput> {
  if ((await fileFingerprint(input.sourcePath, signal)) !== input.sourceFingerprint) {
    throw new Error('mail_attachment_source_changed')
  }
  const target = temporaryPath(input.destinationPath)
  try {
    const bytesWritten = await openPst(input.sourcePath, async (root) => {
      const report: PstWalkReport = { unreadableFolders: [], unreadableMessages: 0 }
      for (const { message } of walkPstMessages(root, report, signal)) {
        if (message.descriptorNodeId.toString() !== input.itemKey) continue
        if (input.attachmentIndex < 0 || input.attachmentIndex >= message.numberOfAttachments) {
          throw new Error('mail_attachment_not_found')
        }
        const attachment = message.getAttachment(input.attachmentIndex)
        assertManifest(
          {
            name: attachment.longFilename?.trim() || attachment.filename?.trim() || 'attachment',
            mimeType: attachment.mimeTag?.trim() || 'application/octet-stream',
            sizeBytes: attachment.filesize || attachment.size || 0
          },
          input
        )
        return writePstAttachment(attachment, target, signal)
      }
      throw new Error('mail_attachment_message_not_found')
    })
    if (bytesWritten !== input.sizeBytes) throw new Error('mail_attachment_size_mismatch')
    if ((await fileFingerprint(input.sourcePath, signal)) !== input.sourceFingerprint) {
      throw new Error('mail_attachment_source_changed')
    }
    return { temporaryPath: target, bytesWritten }
  } catch (error) {
    await unlink(target).catch(() => undefined)
    throw error
  }
}

export async function extractMailArchiveAttachment(
  input: MailArchiveAttachmentExportInput,
  signal: AbortSignal
): Promise<MailArchiveAttachmentExportOutput> {
  if (input.sourceKind === 'eml') return extractEmlAttachment(input, signal)
  return extractPstAttachment(input, signal)
}
