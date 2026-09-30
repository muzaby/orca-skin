import { basename } from 'node:path'
import type {
  MailArchiveAttachment,
  MailArchiveBodyKind,
  MailArchiveBodyQualityFlag,
  MailArchiveBodySelectionReason,
  MailArchiveBodySegment,
  MailArchiveMessage,
  MailArchiveSearchHit,
  MailArchiveSourceKind
} from '../../../../shared/mail-archive'
import { archiveMailIdentityKey, archiveSourceId } from './identity'
import type { NormalizedArchiveMail } from './types'

export interface ArchiveMailRow {
  id: string
  source_kind: MailArchiveSourceKind
  source_id: string | null
  source_path: string
  source_fingerprint: string
  item_key: string
  folder_path: string | null
  sent_at: number | null
  imported_at: number
  from_addr: string
  to_addrs: string
  cc_addrs: string
  subject: string
  body_text: string
  body_kind: MailArchiveBodyKind
  body_alternate_text: string | null
  body_alternate_kind: Exclude<MailArchiveBodyKind, 'none' | 'legacy'> | null
  body_alternate_omitted: number
  body_quality_flags: string
  body_selection_reason: MailArchiveBodySelectionReason
  message_id: string | null
  in_reply_to: string | null
  references_header: string | null
  thread_key: string
  size_bytes: number
  attachment_names: string
}

export type ArchiveHitRow = Pick<
  ArchiveMailRow,
  | 'id'
  | 'source_kind'
  | 'source_path'
  | 'folder_path'
  | 'sent_at'
  | 'from_addr'
  | 'to_addrs'
  | 'cc_addrs'
  | 'subject'
  | 'body_text'
  | 'attachment_names'
> & { rank: number }
export type ArchiveMessageRow = Omit<
  ArchiveMailRow,
  'source_id' | 'source_fingerprint' | 'item_key' | 'size_bytes'
> & { rank: number }

const BODY_QUALITY_FLAGS = new Set<MailArchiveBodyQualityFlag>([
  'alternative_mismatch',
  'decode_suspect',
  'html_converted',
  'oversized'
])
function bodyFields(
  row: Omit<ArchiveMessageRow, 'rank'>
): Pick<
  NormalizedArchiveMail,
  | 'bodyText'
  | 'bodyKind'
  | 'bodyAlternateText'
  | 'bodyAlternateKind'
  | 'bodyAlternateOmitted'
  | 'bodyQualityFlags'
  | 'bodySelectionReason'
> {
  const flags: unknown = JSON.parse(row.body_quality_flags)
  if (!Array.isArray(flags)) throw new Error('mail_archive_body_quality_invalid')
  return {
    bodyText: row.body_text,
    bodyKind: row.body_kind,
    bodyAlternateText: row.body_alternate_text,
    bodyAlternateKind: row.body_alternate_kind,
    bodyAlternateOmitted: row.body_alternate_omitted === 1,
    bodyQualityFlags: flags.filter(
      (flag): flag is MailArchiveBodyQualityFlag =>
        typeof flag === 'string' && BODY_QUALITY_FLAGS.has(flag as MailArchiveBodyQualityFlag)
    ),
    bodySelectionReason: row.body_selection_reason
  }
}

export function normalizedArchiveMail(
  row: ArchiveMailRow,
  attachments: readonly Omit<MailArchiveAttachment, 'id'>[]
): NormalizedArchiveMail {
  const partial: Omit<NormalizedArchiveMail, 'identityKey'> = {
    sourceKind: row.source_kind,
    sourceId: row.source_id ?? archiveSourceId(row.source_kind, row.source_path),
    sourcePath: row.source_path,
    sourceFingerprint: row.source_fingerprint,
    itemKey: row.item_key,
    folderPath: row.folder_path,
    sentAt: row.sent_at,
    from: row.from_addr,
    to: row.to_addrs,
    cc: row.cc_addrs,
    subject: row.subject,
    ...bodyFields(row),
    messageId: row.message_id,
    inReplyTo: row.in_reply_to,
    references: row.references_header,
    threadKey: row.thread_key,
    attachments,
    sizeBytes: row.size_bytes
  }
  return { ...partial, identityKey: archiveMailIdentityKey(partial) }
}

export function archiveQueryTerms(query: string): string[] {
  return query.trim().split(/\s+/).filter(Boolean)
}
function snippet(value: string, query: string): string {
  const text = value.replace(/\s+/g, ' ').trim()
  const terms = archiveQueryTerms(query)
  if (terms.length === 0) return text.slice(0, 280)
  const lowered = text.toLocaleLowerCase()
  const index = terms
    .map((term) => lowered.indexOf(term.toLocaleLowerCase()))
    .filter((match) => match >= 0)
    .sort((left, right) => left - right)[0]
  if (index === undefined) return text.slice(0, 280)
  const start = Math.max(0, index - 90)
  return `${start > 0 ? '…' : ''}${text.slice(start, index + Math.max(180, query.length + 80)).slice(0, 280)}${start + 280 < text.length ? '…' : ''}`
}
export function archiveHit(row: ArchiveHitRow, query: string): MailArchiveSearchHit {
  return {
    id: row.id,
    sourceKind: row.source_kind,
    sourceName: basename(row.source_path),
    folderPath: row.folder_path,
    date: row.sent_at,
    from: row.from_addr,
    to: row.to_addrs,
    cc: row.cc_addrs,
    subject: row.subject,
    snippet: snippet(`${row.subject} ${row.body_text}`, query),
    rank: row.rank,
    attachmentNames: row.attachment_names ? (JSON.parse(row.attachment_names) as string[]) : []
  }
}
export function archiveMessage(
  row: ArchiveMessageRow,
  attachments: readonly MailArchiveAttachment[],
  bodySegments: readonly MailArchiveBodySegment[]
): MailArchiveMessage {
  return {
    ...archiveHit(row, ''),
    ...bodyFields(row),
    messageId: row.message_id,
    inReplyTo: row.in_reply_to,
    references: row.references_header,
    threadKey: row.thread_key,
    bodySegments,
    importedAt: row.imported_at,
    attachments
  }
}
