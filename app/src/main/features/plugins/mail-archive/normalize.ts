import type { Address, Email } from 'postal-mime'
import type { PSTMessage } from 'pst-extractor'
import type { NormalizedArchiveMail } from './types'
import { archiveMailIdentityKey } from './identity'
import { selectMailBody } from './body-selection'

/** 이름과 주소를 함께 남겨 둘 중 무엇으로도 찾을 수 있게 한다. */
function party(name: string | null | undefined, address: string | null | undefined): string {
  const displayName = name?.trim() ?? ''
  const mailbox = address?.trim() ?? ''
  if (displayName && mailbox && displayName.toLocaleLowerCase() !== mailbox.toLocaleLowerCase()) {
    return `${displayName} <${mailbox}>`
  }
  return mailbox || displayName
}

function emlParty(value: Address | undefined): string {
  if (!value) return ''
  if ('group' in value && value.group) return value.group.map(emlParty).filter(Boolean).join(', ')
  return party(value.name, 'address' in value ? value.address : '')
}

function emlParties(value: readonly Address[] | undefined): string {
  return (value ?? []).map(emlParty).filter(Boolean).join(', ')
}

function cleanHeader(value: string | undefined | null): string | null {
  const normalized = value?.trim().replace(/\s+/g, ' ')
  return normalized ? normalized : null
}

function parseDate(value: string | undefined): number | null {
  const parsed = value ? Date.parse(value) : Number.NaN
  return Number.isFinite(parsed) ? parsed : null
}

function manifestEntry(
  name: string | null | undefined,
  mimeType: string | null | undefined,
  sizeBytes: number
): NormalizedArchiveMail['attachments'][number] {
  return {
    name: name?.trim() || 'attachment',
    mimeType: mimeType?.trim() || 'application/octet-stream',
    sizeBytes: Math.max(0, sizeBytes)
  }
}

export function normalizeEml(
  email: Email,
  input: { readonly sourceId: string; readonly itemKey: string }
): NormalizedArchiveMail {
  const normalized: Omit<NormalizedArchiveMail, 'identityKey'> = {
    sourceId: input.sourceId,
    itemKey: input.itemKey,
    folderPath: null,
    sentAt: parseDate(email.date),
    from: emlParty(email.from),
    to: emlParties(email.to),
    cc: emlParties(email.cc),
    subject: email.subject?.trim() ?? '',
    ...selectMailBody({ plainText: email.text, html: email.html }),
    messageId: cleanHeader(email.messageId),
    inReplyTo: cleanHeader(email.inReplyTo),
    references: cleanHeader(email.references),
    attachments: (email.attachments ?? []).map((attachment) =>
      manifestEntry(
        attachment.filename,
        attachment.mimeType,
        typeof attachment.content === 'string'
          ? Buffer.byteLength(attachment.content, 'utf8')
          : attachment.content.byteLength
      )
    )
  }
  return { ...normalized, identityKey: archiveMailIdentityKey(normalized) }
}

/** RFC 5322 헤더 블록에서 한 헤더를 접힌 줄까지 합쳐 읽는다. */
function transportHeader(headers: string, name: string): string | null {
  const match = new RegExp(`^${name}:[ \\t]*(.*(?:\\r?\\n[ \\t]+.*)*)`, 'im').exec(headers)
  return cleanHeader(match?.[1])
}

interface PstRecipientLike {
  readonly recipientType?: number
  readonly displayName?: string
  readonly smtpAddress?: string
  readonly emailAddress?: string
}

function smtp(address: string | null | undefined): string {
  return address && address.includes('@') && !address.startsWith('/') ? address : ''
}

/** 수신자 테이블에서 이름·SMTP 주소를 읽고, 읽을 수 없으면 PST 표시 문자열을 쓴다. */
function pstRecipients(message: PSTMessage): { to: string; cc: string } {
  const to: string[] = []
  const cc: string[] = []
  try {
    for (let index = 0; index < message.numberOfRecipients; index += 1) {
      const recipient = message.getRecipient(index) as PstRecipientLike | null
      if (!recipient) continue
      const value = party(
        recipient.displayName,
        smtp(recipient.smtpAddress) || smtp(recipient.emailAddress)
      )
      if (!value) continue
      if (recipient.recipientType === 1) to.push(value)
      else if (recipient.recipientType === 2) cc.push(value)
    }
  } catch {
    // 손상된 수신자 테이블은 아래 표시 문자열로 대신한다.
  }
  return {
    to: to.length > 0 ? to.join(', ') : (message.displayTo?.trim() ?? ''),
    cc: cc.length > 0 ? cc.join(', ') : (message.displayCC?.trim() ?? '')
  }
}

export function normalizePst(
  message: PSTMessage,
  input: { readonly sourceId: string; readonly folderPath: string; readonly itemKey: string }
): NormalizedArchiveMail {
  const headers = message.transportMessageHeaders ?? ''
  const sentAt = message.clientSubmitTime ?? message.messageDeliveryTime
  const normalized: Omit<NormalizedArchiveMail, 'identityKey'> = {
    sourceId: input.sourceId,
    itemKey: input.itemKey,
    folderPath: input.folderPath,
    sentAt: sentAt ? sentAt.getTime() : null,
    // Exchange 내부 발신자의 주소는 X.500 DN이라 SMTP 형식일 때만 이름 옆에 붙인다.
    from: party(message.senderName, smtp(message.senderEmailAddress)),
    ...pstRecipients(message),
    subject: message.subject?.trim() ?? '',
    ...selectMailBody({ plainText: message.body, html: message.bodyHTML }),
    messageId: cleanHeader(message.internetMessageId),
    inReplyTo: cleanHeader(message.inReplyToId) ?? transportHeader(headers, 'In-Reply-To'),
    references: transportHeader(headers, 'References'),
    attachments: Array.from({ length: Math.max(0, message.numberOfAttachments) }, (_, index) => {
      const attachment = message.getAttachment(index)
      return manifestEntry(
        attachment.longFilename || attachment.filename,
        attachment.mimeTag,
        attachment.filesize || attachment.size || 0
      )
    })
  }
  return { ...normalized, identityKey: archiveMailIdentityKey(normalized) }
}
