import { z } from 'zod'
import { isAbsolutePath } from './absolute-path'

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
  readonly bodyKind: MailArchiveBodyKind
  readonly bodyAlternateText: string | null
  readonly bodyAlternateKind: Exclude<MailArchiveBodyKind, 'none' | 'legacy'> | null
  readonly bodyAlternateOmitted: boolean
  readonly bodyQualityFlags: readonly MailArchiveBodyQualityFlag[]
  readonly bodySelectionReason: MailArchiveBodySelectionReason
  readonly importedAt: number
  readonly attachments: readonly MailArchiveAttachment[]
}

export interface MailArchiveImportRequest {
  readonly inputKind: MailArchiveInputKind
  readonly paths: readonly string[]
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

const absolutePath = z
  .string()
  .trim()
  .min(1)
  .max(4096)
  .refine(isAbsolutePath, '메일 원본 경로는 절대 경로여야 합니다')

export const MailArchiveImportRequestSchema = z
  .object({
    inputKind: z.enum(['files', 'eml-folder']),
    paths: z.array(absolutePath).min(1).max(1000)
  })
  .strict()

export const MailArchiveSearchRequestSchema = z
  .object({
    query: z.string().trim().max(500),
    sourceKind: z.enum(MAIL_ARCHIVE_SOURCE_KINDS).optional(),
    limit: z.number().int().min(1).max(100).optional()
  })
  .strict()

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
