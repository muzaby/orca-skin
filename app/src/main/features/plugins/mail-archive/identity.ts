import { createHash } from 'node:crypto'
import { resolve } from 'node:path'
import type { MailArchiveSourceKind } from '../../../../shared/mail-archive'
import type { NormalizedArchiveMail } from './types'

function hash(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

/** 자료원 경로 비교용 정규형. Windows 경로는 대소문자를 구분하지 않는다. */
export function normalizedSourcePath(path: string): string {
  const absolute = resolve(path).normalize('NFC')
  return process.platform === 'win32' ? absolute.toLocaleLowerCase('en-US') : absolute
}

/** A file's identity survives content changes; its full fingerprint belongs to a revision. */
export function archiveSourceId(sourceKind: MailArchiveSourceKind, sourcePath: string): string {
  return hash(`${sourceKind}\0${normalizedSourcePath(sourcePath)}`)
}

function normalizedText(value: string): string {
  return value.normalize('NFC').replace(/\s+/g, ' ').trim()
}

function lower(value: string | null): string | null {
  return value?.trim().toLocaleLowerCase('en-US') ?? null
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
    lower(mail.inReplyTo),
    lower(mail.references),
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
  const messageId = lower(mail.messageId)
  const identity = messageId
    ? `message-id\0${messageId}\0${contentDigest(mail)}`
    : `${mail.sourceId}\0${mail.itemKey}\0${contentDigest(mail)}`
  return hash(identity)
}
