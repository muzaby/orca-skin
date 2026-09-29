import { createHash, randomUUID } from 'node:crypto'
import { fingerprint } from '../fingerprint'
import { walkPstMail } from './pst-walk'
import { open, unlink, writeFile } from 'node:fs/promises'
import { basename, dirname, join, resolve } from 'node:path'
import PostalMime from 'postal-mime'
import { readEmlBytes } from './eml-bytes'
import type { PSTAttachment } from 'pst-extractor'
import { normalizeEml } from '../normalize'
import type { MailArchiveAttachmentExportInput, MailArchiveAttachmentExportOutput } from '../types'

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

async function extractEmlAttachment(
  input: MailArchiveAttachmentExportInput,
  signal: AbortSignal
): Promise<MailArchiveAttachmentExportOutput> {
  const raw = await readEmlBytes(input.sourcePath, signal)
  signal.throwIfAborted()
  if (createHash('sha256').update(raw).digest('hex') !== input.sourceFingerprint) {
    throw new Error('mail_attachment_source_changed')
  }
  const email = await PostalMime.parse(raw, { forceRfc822Attachments: true })
  signal.throwIfAborted()
  const normalized = normalizeEml(email, {
    sourceId: input.sourceId,
    sourcePath: input.sourcePath,
    sourceFingerprint: input.sourceFingerprint,
    sizeBytes: raw.byteLength
  })
  if (normalized.itemKey !== input.itemKey) throw new Error('mail_attachment_message_changed')
  const attachment = email.attachments?.[input.attachmentIndex]
  if (!attachment) throw new Error('mail_attachment_not_found')
  const name = attachment.filename?.trim() || 'attachment'
  const mimeType = attachment.mimeType?.trim() || 'application/octet-stream'
  const content = attachment.content
  const bytes =
    typeof content === 'string'
      ? Buffer.from(content, 'utf8')
      : Buffer.from(content instanceof ArrayBuffer ? new Uint8Array(content) : content)
  assertManifest({ name, mimeType, sizeBytes: bytes.byteLength }, input)

  const target = temporaryPath(input.destinationPath)
  try {
    await writeFile(target, bytes, { flag: 'wx' })
    signal.throwIfAborted()
    if ((await fingerprint(input.sourcePath, signal)) !== input.sourceFingerprint) {
      throw new Error('mail_attachment_source_changed')
    }
    return { temporaryPath: target, bytesWritten: bytes.byteLength }
  } catch (error) {
    await unlink(target).catch(() => undefined)
    throw error
  }
}

function attachmentManifest(attachment: PSTAttachment): {
  name: string
  mimeType: string
  sizeBytes: number
} {
  return {
    name: attachment.longFilename?.trim() || attachment.filename?.trim() || 'attachment',
    mimeType: attachment.mimeTag?.trim() || 'application/octet-stream',
    sizeBytes: attachment.filesize || attachment.size || 0
  }
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

async function extractPstAttachment(
  input: MailArchiveAttachmentExportInput,
  signal: AbortSignal
): Promise<MailArchiveAttachmentExportOutput> {
  if ((await fingerprint(input.sourcePath, signal)) !== input.sourceFingerprint) {
    throw new Error('mail_attachment_source_changed')
  }
  const { PSTFile } = await import('pst-extractor')
  const pst = new PSTFile(input.sourcePath)
  const target = temporaryPath(input.destinationPath)
  let selected: PSTAttachment | undefined
  try {
    await walkPstMail(
      pst.getRootFolder(),
      (candidate) => {
        if (candidate.descriptorNodeId.toString() !== input.itemKey) return
        if (input.attachmentIndex < 0 || input.attachmentIndex >= candidate.numberOfAttachments) {
          throw new Error('mail_attachment_not_found')
        }
        selected = candidate.getAttachment(input.attachmentIndex)
      },
      signal
    )
    if (!selected) throw new Error('mail_attachment_message_not_found')
    assertManifest(attachmentManifest(selected), input)
    const bytesWritten = await writePstAttachment(selected, target, signal)
    if (bytesWritten !== input.sizeBytes) throw new Error('mail_attachment_size_mismatch')
    if ((await fingerprint(input.sourcePath, signal)) !== input.sourceFingerprint) {
      throw new Error('mail_attachment_source_changed')
    }
    return { temporaryPath: target, bytesWritten }
  } catch (error) {
    await unlink(target).catch(() => undefined)
    throw error
  } finally {
    pst.close()
  }
}

export async function extractMailArchiveAttachment(
  input: MailArchiveAttachmentExportInput,
  signal: AbortSignal
): Promise<MailArchiveAttachmentExportOutput> {
  if (input.sourceKind === 'eml') return extractEmlAttachment(input, signal)
  return extractPstAttachment(input, signal)
}
