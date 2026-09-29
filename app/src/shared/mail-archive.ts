import { z } from 'zod'

export type MailArchiveSourceKind = 'eml' | 'pst'

export interface MailArchiveAttachment {
  readonly id: string
  readonly name: string
  readonly mimeType: string
  readonly sizeBytes: number
}

export type MailArchiveBodyKind = 'plain' | 'html' | 'none'
export type MailArchiveBodyQualityFlag =
  'alternative_mismatch' | 'decode_suspect' | 'html_converted' | 'oversized'
export type MailArchiveBodySelectionReason =
  | 'plain_preferred'
  | 'plain_placeholder_fallback'
  | 'plain_unusable_fallback'
  | 'html_only'
  | 'empty'
  | 'oversized'

export interface MailArchiveSearchHit {
  readonly id: string
  readonly sourceName: string
  readonly folderPath: string | null
  readonly date: number | null
  readonly from: string
  readonly subject: string
  readonly snippet: string
  readonly attachmentNames: readonly string[]
}

export interface MailArchiveMessage {
  readonly id: string
  readonly sourceName: string
  readonly folderPath: string | null
  readonly date: number | null
  readonly from: string
  readonly to: string
  readonly cc: string
  readonly subject: string
  readonly bodyText: string
  readonly bodyKind: MailArchiveBodyKind
  readonly bodyAlternateText: string | null
  readonly bodyAlternateKind: Exclude<MailArchiveBodyKind, 'none'> | null
  readonly bodyAlternateOmitted: boolean
  readonly bodyQualityFlags: readonly MailArchiveBodyQualityFlag[]
  readonly bodySelectionReason: MailArchiveBodySelectionReason
  readonly attachments: readonly MailArchiveAttachment[]
}

export interface MailArchiveImportFailure {
  /** 파일 이름만 담는다. 원본 전체 경로는 renderer로 보내지 않는다. */
  readonly path: string
  readonly reason: string
}

export interface MailArchiveImportResult {
  readonly jobId: string
  readonly state: 'completed' | 'cancelled'
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
  readonly cancellable: boolean
}

export interface MailArchiveSearchRequest {
  readonly query: string
  readonly sourceId?: string
  readonly limit?: number
}

export interface MailArchiveThreadRequest {
  readonly id: string
  readonly limit?: number
}

export interface MailArchiveThreadItem {
  readonly id: string
  readonly subject: string
  readonly from: string
  readonly date: number | null
}

export interface MailArchiveThreadResult {
  readonly mails: readonly MailArchiveThreadItem[]
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
}

export interface MailArchiveSource {
  readonly id: string
  readonly kind: MailArchiveSourceKind
  readonly name: string
  readonly messageCount: number
  readonly sharedMessageCount: number
}

export interface MailArchiveSourceDeletion {
  readonly sourceName: string
  readonly removedMessages: number
  readonly preservedMessages: number
}

export type MailArchiveSourceRemovalResult =
  | ({ readonly state: 'removed'; readonly importCancelled: boolean } & MailArchiveSourceDeletion)
  | { readonly state: 'cancelled' }
  | { readonly state: 'not-found' }

const id = z.string().trim().min(1).max(128)

/** 메일·자료원·첨부·작업 ID 하나만 받는 요청. */
export const MailArchiveIdRequestSchema = z.object({ id }).strict()

export const MailArchiveSearchRequestSchema = z
  .object({
    query: z.string().trim().max(500),
    sourceId: id.optional(),
    limit: z.number().int().min(1).max(100).optional()
  })
  .strict()

export const MailArchiveThreadRequestSchema = z
  .object({ id, limit: z.number().int().min(1).max(100).optional() })
  .strict()
