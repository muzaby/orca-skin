import type { Email, Address } from 'postal-mime'
import type { MailDocument, MailAttachment } from './types'

function addresses(value: Address[] | undefined): string {
  return (value ?? [])
    .map((item) =>
      'address' in item && item.address
        ? item.address
        : (item.group?.map((m) => m.address).join(',') ?? '')
    )
    .filter(Boolean)
    .join(', ')
}

function asBytes(value: ArrayBuffer | Uint8Array | string): Uint8Array {
  if (typeof value === 'string') return Buffer.from(value, 'utf8')
  return value instanceof Uint8Array ? value : new Uint8Array(value)
}

export function normalizeMail(
  email: Email,
  input: { remoteUid: string; ordinal: number; firstSeenAt: number; sizeBytes?: number }
): MailDocument {
  const parsedDate = email.date ? Date.parse(email.date) : Number.NaN
  const headerDate = Number.isFinite(parsedDate) && parsedDate >= 0 ? parsedDate : null
  const attachments: MailAttachment[] = (email.attachments ?? []).map((attachment) => {
    const bytes = asBytes(attachment.content)
    return {
      filename: attachment.filename || 'attachment',
      mimeType: attachment.mimeType || 'application/octet-stream',
      sizeBytes: bytes.byteLength,
      bytes
    }
  })
  return {
    remoteUid: input.remoteUid,
    ordinal: input.ordinal,
    headerDate,
    firstSeenAt: input.firstSeenAt,
    effectiveDate: headerDate ?? input.firstSeenAt,
    fromAddr: addresses(email.from ? [email.from] : undefined),
    toAddrs: addresses(email.to),
    ccAddrs: addresses(email.cc),
    subject: email.subject ?? '',
    bodyText: email.text ?? '',
    sizeBytes:
      input.sizeBytes ??
      email.attachments?.reduce(
        (total, attachment) => total + asBytes(attachment.content).byteLength,
        0
      ) ??
      0,
    attachments
  }
}
