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

function referencedContentIds(html: string | undefined): Set<string> {
  const ids = new Set<string>()
  for (const match of (html ?? '').matchAll(/\bcid:([^\s"'<>()]+)/gi)) {
    try {
      ids.add(decodeURIComponent(match[1]))
    } catch {
      ids.add(match[1])
    }
  }
  return ids
}

export function normalizeMail(
  email: Email,
  input: { uidl: string; messageNumber: number; firstSeenAt: number; sizeBytes?: number }
): MailDocument {
  const parsedDate = email.date ? Date.parse(email.date) : Number.NaN
  const headerDate = Number.isFinite(parsedDate) && parsedDate >= 0 ? parsedDate : null
  const referencedIds = referencedContentIds(email.html)
  const attachments: MailAttachment[] = (email.attachments ?? [])
    .filter((attachment) => {
      const contentId = attachment.contentId?.replace(/^<|>$/g, '')
      const embedded =
        attachment.related ||
        attachment.disposition === 'inline' ||
        (contentId !== undefined && referencedIds.has(contentId))
      return !(attachment.mimeType.toLowerCase().startsWith('image/') && embedded)
    })
    .map((attachment) => {
      const bytes = asBytes(attachment.content)
      return {
        filename: attachment.filename || 'attachment',
        mimeType: attachment.mimeType || 'application/octet-stream',
        sizeBytes: bytes.byteLength,
        bytes
      }
    })
  return {
    uidl: input.uidl,
    messageNumber: input.messageNumber,
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
