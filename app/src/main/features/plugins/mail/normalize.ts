import type { Email, Address } from 'postal-mime'
import type { MailDocument, MailAttachment, MailBodySource } from './types'
import { decodeHtmlBytes, htmlToBodyText } from './html-body'

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

export interface NormalizeMailDeps {
  // 테스트 seam. production 은 기본값 `htmlToBodyText` 를 쓴다.
  readonly htmlToText?: (html: string) => string
}

// 한 단계의 변환 결과. 비었거나 throw 하면 그 단계는 결과가 없다 — 다음 단계로 간다.
function attempt(produce: () => string): string | null {
  try {
    const text = produce()
    return text.trim() ? text : null
  } catch {
    return null
  }
}

// 본문 선택 체인 plain → html → 첫 HTML 첨부 → none (0302 D-014).
function selectBody(
  email: Email,
  htmlToText: (html: string) => string
): { bodyText: string; bodySource: MailBodySource } {
  if (email.text?.trim()) return { bodyText: email.text, bodySource: 'plain' }
  const html = email.html ? attempt(() => htmlToText(email.html as string)) : null
  if (html !== null) return { bodyText: html, bodySource: 'html' }
  // 첫 번째 HTML 첨부 하나만 본다 — 메일당 변환을 최대 2회로 묶는다. 첨부 목록에서 빼지 않는다.
  const attachment = (email.attachments ?? []).find(
    (item) => item.mimeType?.toLowerCase() === 'text/html'
  )
  const fromAttachment = attachment
    ? attempt(() => htmlToText(decodeHtmlBytes(asBytes(attachment.content))))
    : null
  if (fromAttachment !== null) return { bodyText: fromAttachment, bodySource: 'attachment' }
  return { bodyText: '', bodySource: 'none' }
}

export function normalizeMail(
  email: Email,
  input: { uidl: string; messageNumber: number; firstSeenAt: number; sizeBytes?: number },
  deps: NormalizeMailDeps = {}
): MailDocument {
  const body = selectBody(email, deps.htmlToText ?? htmlToBodyText)
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
    bodyText: body.bodyText,
    bodySource: body.bodySource,
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
