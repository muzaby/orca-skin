import type { Address, Email } from 'postal-mime'
import { createHash } from 'node:crypto'
import type { PSTMessage } from 'pst-extractor'
import type { NormalizedArchiveMail } from './types'
import { archiveMailIdentityKey } from './identity'
import { selectMailBody } from './body-selection'

function addressValue(value: Address | undefined): string {
  if (!value) return ''
  if ('address' in value && value.address) return value.address
  return (
    value.group
      ?.map((member) => member.address || member.name || '')
      .filter(Boolean)
      .join(', ') ?? ''
  )
}

function addresses(value: readonly Address[] | undefined): string {
  return (value ?? []).map(addressValue).filter(Boolean).join(', ')
}

function cleanHeader(value: string | undefined | null): string | null {
  const normalized = value?.trim().replace(/\s+/g, ' ')
  return normalized ? normalized : null
}

function parseDate(value: string | undefined): number | null {
  const parsed = value ? Date.parse(value) : Number.NaN
  return Number.isFinite(parsed) ? parsed : null
}

function threadKey(
  subject: string,
  messageId: string | null,
  inReplyTo: string | null,
  references: string | null
): string {
  const root = references?.split(/\s+/).filter(Boolean)[0] ?? inReplyTo ?? messageId
  if (root) return root
  return `subject:${subject
    .toLocaleLowerCase()
    .replace(/^\s*(re|fw|fwd)\s*:\s*/gi, '')
    .trim()}`
}

function attachmentManifest(
  attachments: readonly {
    name?: string | null
    mimeType?: string | null
    sizeBytes?: number | null
  }[]
): NormalizedArchiveMail['attachments'] {
  return attachments
    .map((attachment) => ({
      name: attachment.name?.trim() || 'attachment',
      mimeType: attachment.mimeType?.trim() || 'application/octet-stream',
      sizeBytes: Math.max(0, attachment.sizeBytes ?? 0)
    }))
    .filter((attachment) => attachment.name.length > 0)
}

export function normalizeEml(
  email: Email,
  input: { sourceId: string; sourcePath: string; sourceFingerprint: string; sizeBytes: number }
): NormalizedArchiveMail {
  const subject = email.subject?.trim() ?? ''
  const messageId = cleanHeader(email.messageId)
  const inReplyTo = cleanHeader(email.inReplyTo)
  const references = cleanHeader(email.references)
  const body = selectMailBody({ plainText: email.text, html: email.html })
  const attachments = attachmentManifest(
    (email.attachments ?? []).map((attachment) => ({
      name: attachment.filename,
      mimeType: attachment.mimeType,
      sizeBytes:
        typeof attachment.content === 'string'
          ? Buffer.byteLength(attachment.content, 'utf8')
          : attachment.content instanceof Uint8Array
            ? attachment.content.byteLength
            : attachment.content.byteLength
    }))
  )
  const normalized: Omit<NormalizedArchiveMail, 'identityKey'> = {
    sourceKind: 'eml',
    sourceId: input.sourceId,
    sourcePath: input.sourcePath,
    sourceFingerprint: input.sourceFingerprint,
    itemKey: messageId ?? createHash('sha256').update(input.sourcePath).digest('hex'),
    folderPath: null,
    sentAt: parseDate(email.date),
    from: addressValue(email.from),
    to: addresses(email.to),
    cc: addresses(email.cc),
    subject,
    ...body,
    messageId,
    inReplyTo,
    references,
    threadKey: threadKey(subject, messageId, inReplyTo, references),
    attachments,
    sizeBytes: input.sizeBytes
  }
  return { ...normalized, identityKey: archiveMailIdentityKey(normalized) }
}

export function normalizePst(
  message: PSTMessage,
  input: {
    sourcePath: string
    sourceId: string
    sourceFingerprint: string
    folderPath: string
    itemKey: string
    sizeBytes: number
  }
): NormalizedArchiveMail {
  const subject = message.subject?.trim() ?? ''
  const messageId = cleanHeader(message.internetMessageId)
  const inReplyTo = cleanHeader(message.inReplyToId)
  const body = selectMailBody({ plainText: message.body, html: message.bodyHTML })
  const attachments = attachmentManifest(
    Array.from({ length: Math.max(0, message.numberOfAttachments) }, (_, index) => {
      const attachment = message.getAttachment(index)
      return {
        name: attachment.longFilename || attachment.filename,
        mimeType: attachment.mimeTag,
        sizeBytes: attachment.filesize || attachment.size
      }
    })
  )
  const sender = message.senderEmailAddress?.trim() || message.senderName?.trim() || ''
  const sentAt = message.messageDeliveryTime?.getTime() ?? null
  const conversation = message.conversationId?.toString('hex')
  const normalized: Omit<NormalizedArchiveMail, 'identityKey'> = {
    sourceKind: 'pst',
    sourceId: input.sourceId,
    sourcePath: input.sourcePath,
    sourceFingerprint: input.sourceFingerprint,
    itemKey: input.itemKey,
    folderPath: input.folderPath,
    sentAt,
    from: sender,
    to: message.displayTo?.trim() ?? '',
    cc: message.displayCC?.trim() ?? '',
    subject,
    ...body,
    messageId,
    inReplyTo,
    references: null,
    threadKey: conversation
      ? `conversation:${conversation}`
      : threadKey(subject, messageId, inReplyTo, null),
    attachments,
    sizeBytes: input.sizeBytes
  }
  return { ...normalized, identityKey: archiveMailIdentityKey(normalized) }
}
