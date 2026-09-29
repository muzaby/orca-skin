import { createHash } from 'node:crypto'
import { resolve } from 'node:path'
import type { NormalizedArchiveMail } from './types'

function hash(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

function normalizedPath(path: string): string {
  const absolute = resolve(path).normalize('NFC')
  return process.platform === 'win32' ? absolute.toLocaleLowerCase('en-US') : absolute
}

/** A file's identity survives content changes; its full fingerprint belongs to a revision. */
export function archiveSourceId(
  sourceKind: NormalizedArchiveMail['sourceKind'],
  sourcePath: string
): string {
  return hash(`${sourceKind}\0${normalizedPath(sourcePath)}`)
}

function normalizedText(value: string): string {
  return value.normalize('NFC').replace(/\s+/g, ' ').trim()
}

type MailIdentityInput = Omit<NormalizedArchiveMail, 'identityKey'>

function contentDigest(mail: MailIdentityInput): string {
  const payload = [
    mail.sentAt,
    normalizedText(mail.from).toLocaleLowerCase('en-US'),
    normalizedText(mail.to).toLocaleLowerCase('en-US'),
    normalizedText(mail.cc).toLocaleLowerCase('en-US'),
    normalizedText(mail.subject),
    mail.bodyText.normalize('NFC'),
    mail.inReplyTo?.trim().toLocaleLowerCase('en-US') ?? null,
    mail.references?.trim().toLocaleLowerCase('en-US') ?? null,
    mail.threadKey.trim().toLocaleLowerCase('en-US'),
    mail.attachments.map((attachment) => [
      normalizedText(attachment.name),
      attachment.mimeType.trim().toLocaleLowerCase('en-US'),
      attachment.sizeBytes
    ])
  ]
  return hash(JSON.stringify(payload))
}

/**
 * Message-ID alone can collide or be reused for an edited message. Include its normalized payload.
 * Without a Message-ID, only reuse the same source locator with the exact normalized payload.
 */
export function archiveMailIdentityKey(mail: MailIdentityInput): string {
  const messageId = mail.messageId?.trim().toLocaleLowerCase('en-US')
  const identity = messageId
    ? `${mail.sourceKind}\0message-id\0${messageId}\0${contentDigest(mail)}`
    : `${mail.sourceKind}\0${mail.sourceId}\0${mail.itemKey}\0${contentDigest(mail)}`
  return hash(identity)
}
