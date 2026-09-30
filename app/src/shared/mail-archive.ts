import { z } from 'zod'

export const MAIL_ARCHIVE_SOURCE_KINDS = ['eml', 'pst'] as const
export type MailArchiveSourceKind = (typeof MAIL_ARCHIVE_SOURCE_KINDS)[number]

export type MailArchiveInputKind = 'files' | 'eml-folder'

export interface MailArchiveAttachment {
  readonly id: string
  readonly name: string
  readonly mimeType: string
  readonly sizeBytes: number
}

export type MailArchiveBodyKind = 'plain' | 'html' | 'none' | 'legacy'
export type MailArchiveBodyQualityFlag =
  'alternative_mismatch' | 'decode_suspect' | 'html_converted' | 'oversized'
export type MailArchiveBodySelectionReason =
  | 'plain_preferred'
  | 'plain_placeholder_fallback'
  | 'plain_unusable_fallback'
  | 'html_only'
  | 'empty'
  | 'oversized'
  | 'legacy'

/** Offsets belong exclusively to bodyText and use JavaScript UTF-16 code units. */
export interface MailArchiveBodySegment {
  readonly ordinal: number
  readonly start: number
  readonly end: number
  readonly kind: 'unknown' | 'quote' | 'signature'
  readonly ruleId: string
  readonly classifierRevision: string
  readonly confidenceClass: 'certain' | 'uncertain'
}

export interface MailArchiveSearchHit {
  readonly id: string
  readonly sourceKind: MailArchiveSourceKind
  readonly sourceName: string
  readonly folderPath: string | null
  readonly date: number | null
  readonly from: string
  readonly to: string
  readonly cc: string
  readonly subject: string
  readonly snippet: string
  readonly rank: number
  readonly attachmentNames: readonly string[]
}

export interface MailArchiveMessage extends MailArchiveSearchHit {
  readonly messageId: string | null
  readonly inReplyTo: string | null
  readonly references: string | null
  readonly threadKey: string
  readonly bodyText: string
  readonly bodySegments: readonly MailArchiveBodySegment[]
  readonly bodyKind: MailArchiveBodyKind
  readonly bodyAlternateText: string | null
  readonly bodyAlternateKind: Exclude<MailArchiveBodyKind, 'none' | 'legacy'> | null
  readonly bodyAlternateOmitted: boolean
  readonly bodyQualityFlags: readonly MailArchiveBodyQualityFlag[]
  readonly bodySelectionReason: MailArchiveBodySelectionReason
  readonly importedAt: number
  readonly attachments: readonly MailArchiveAttachment[]
}

/** Opaque, one-use capability. Original paths remain in the main process. */
export interface MailArchiveImportRequest {
  readonly selectionId: string
}

export interface MailArchiveImportFailure {
  readonly path: string
  readonly reason: string
}

export type MailArchiveImportState = 'completed' | 'cancelled'

export interface MailArchiveImportResult {
  readonly jobId: string
  readonly state: MailArchiveImportState
  readonly files: number
  readonly ignoredItems?: number
  readonly messages: number
  readonly inserted: number
  readonly skipped: number
  readonly failures: readonly MailArchiveImportFailure[]
}

export interface MailArchiveProgress {
  readonly jobId: string
  readonly state: 'running' | 'completed' | 'cancelled'
  readonly currentPath: string | null
  readonly processedFiles: number
  readonly totalFiles: number
  readonly processedMessages: number
  readonly insertedMessages: number
  readonly skippedMessages: number
  readonly failedFiles: number
  readonly cancellable: boolean
}

export interface MailArchiveSearchRequest {
  readonly query: string
  readonly sourceKind?: MailArchiveSourceKind
  readonly sourceId?: string
  readonly from?: string
  readonly to?: string
  readonly cc?: string
  readonly attachmentName?: string
  readonly folderPath?: string
  readonly sentAfter?: number
  readonly sentBefore?: number
  readonly limit?: number
}

export interface MailArchiveGetRequest {
  readonly id: string
}

export interface MailArchiveThreadRequest extends MailArchiveGetRequest {
  readonly limit?: number
}

export interface MailArchiveThreadRelation {
  readonly childMailId: string
  readonly parentMailId: string
  readonly kind: 'reply' | 'reference'
}

export interface MailArchiveThreadResult {
  readonly mails: readonly MailArchiveSearchHit[]
  readonly relations: readonly MailArchiveThreadRelation[]
  readonly truncated: boolean
}

export type MailArchiveAttachmentExportResult =
  | { readonly state: 'exported'; readonly name: string; readonly sizeBytes: number }
  | { readonly state: 'cancelled' }
  | { readonly state: 'not-found' }

export interface MailArchiveStats {
  readonly progress?: MailArchiveProgress | null
  readonly lastImport?: MailArchiveImportResult | null
  readonly totalMessages: number
  readonly emlMessages: number
  readonly pstMessages: number
  readonly lastImportedAt: number | null
}

export interface MailArchiveSource {
  readonly id: string
  readonly kind: MailArchiveSourceKind
  readonly name: string
  readonly messageCount: number
  readonly sharedMessageCount: number
  readonly lastImportedAt: number | null
}

export interface MailArchiveSourceDeletion {
  readonly sourceName: string
  readonly removedMessages: number
  readonly preservedMessages: number
}

export type MailArchiveSourceRemovalResult =
  | {
      readonly state: 'removed'
      readonly sourceName: string
      readonly removedMessages: number
      readonly preservedMessages: number
      readonly importCancelled: boolean
    }
  | { readonly state: 'cancelled' }
  | { readonly state: 'not-found' }

export const MailArchiveImportRequestSchema = z.object({ selectionId: z.string().uuid() }).strict()

export const MailArchiveSearchRequestSchema = z
  .object({
    query: z.string().trim().max(500),
    sourceKind: z.enum(MAIL_ARCHIVE_SOURCE_KINDS).optional(),
    sourceId: z.string().min(1).max(128).optional(),
    from: z.string().trim().max(500).optional(),
    to: z.string().trim().max(500).optional(),
    cc: z.string().trim().max(500).optional(),
    attachmentName: z.string().trim().max(500).optional(),
    folderPath: z.string().trim().max(500).optional(),
    sentAfter: z.number().int().min(-8_640_000_000_000_000).max(8_640_000_000_000_000).optional(),
    sentBefore: z.number().int().min(-8_640_000_000_000_000).max(8_640_000_000_000_000).optional(),
    limit: z.number().int().min(1).max(100).optional()
  })
  .strict()
  .refine(
    ({ sentAfter, sentBefore }) =>
      sentAfter === undefined || sentBefore === undefined || sentAfter < sentBefore,
    { message: 'mail_archive_date_range_invalid' }
  )

export const MailArchiveGetRequestSchema = z
  .object({ id: z.string().trim().min(1).max(128) })
  .strict()

export const MailArchiveThreadRequestSchema = z
  .object({
    id: z.string().trim().min(1).max(128),
    limit: z.number().int().min(1).max(100).optional()
  })
  .strict()

export const MailArchiveCancelRequestSchema = MailArchiveGetRequestSchema

export const MailArchiveSourceRequestSchema = z
  .object({ id: z.string().trim().min(1).max(128) })
  .strict()

export const MailArchiveAttachmentRequestSchema = MailArchiveSourceRequestSchema
