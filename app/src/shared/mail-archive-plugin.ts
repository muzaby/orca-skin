import { z } from 'zod'
import { MailArchiveSearchRequestSchema } from './mail-archive'
import type {
  MailArchiveMessage,
  MailArchiveSearchHit,
  MailArchiveThreadResult
} from './mail-archive'

export const ARCHIVE_MCP_SERVER_ID = 'orca_mail_archive'
export const ARCHIVE_MCP_TOOLS = [
  'archive_search',
  'archive_get',
  'archive_thread',
  'archive_context'
] as const
export const ARCHIVE_MCP_MAX_BYTES = 64 * 1024
export const ArchiveSessionSchema = z.object({ sessionId: z.string().min(1).max(128) }).strict()
export const ArchiveScopeSchema = ArchiveSessionSchema.extend({
  sourceIds: z.array(z.string().min(1).max(128)).max(100),
  sentAfter: z.number().int().optional(),
  sentBefore: z.number().int().optional()
})
  .strict()
  .superRefine((input, ctx) => {
    if (
      !MailArchiveSearchRequestSchema.safeParse({
        query: '',
        sentAfter: input.sentAfter,
        sentBefore: input.sentBefore
      }).success
    )
      ctx.addIssue({ code: 'custom', message: 'mail_archive_date_range_invalid' })
    if (new Set(input.sourceIds).size !== input.sourceIds.length)
      ctx.addIssue({ code: 'custom', message: 'mail_archive_scope_invalid' })
  })
export const ArchiveEvidenceSchema = ArchiveSessionSchema.extend({ id: z.string().uuid() }).strict()
export type ArchiveScopeInput = z.infer<typeof ArchiveScopeSchema>
export interface ArchiveReadScope {
  sourceIds: readonly string[]
  sentAfter?: number
  sentBefore?: number
}
export interface ArchiveScopeLease extends ArchiveReadScope {
  sessionId: string
  token: string
  corpusRevision: number
}
export interface ArchiveEvidence {
  id: string
  mailId: string
  start: number
  end: number
  text: string
  subject: string
  from: string
  date: number | null
}
export type ArchiveEvidenceResult =
  | { state: 'available'; evidence: ArchiveEvidence; mail: MailArchiveMessage }
  | { state: 'removed' | 'forbidden' }
export interface ArchivePluginState {
  available: boolean
  registered: boolean
  serverId: typeof ARCHIVE_MCP_SERVER_ID
  tools: readonly string[]
  scope: ArchiveReadScope | null
}
export type ArchivePluginRequest =
  | { operation: 'setScope'; input: ArchiveScopeInput }
  | { operation: 'scope'; sessionId: string }
  | { operation: 'dispose'; sessionId: string }
  | { operation: 'prune'; sessionIds: readonly string[] }
  | { operation: 'assert'; lease: ArchiveScopeLease }
  | {
      operation: 'search'
      lease: ArchiveScopeLease
      query: z.infer<typeof MailArchiveSearchRequestSchema>
    }
  | { operation: 'get'; lease: ArchiveScopeLease; id: string }
  | { operation: 'thread'; lease: ArchiveScopeLease; id: string; limit: number }
  | {
      operation: 'evidence'
      lease: ArchiveScopeLease
      spans: readonly { mailId: string; start: number; end: number }[]
    }
  | { operation: 'resolve'; sessionId: string; id: string }
export interface ArchivePluginResponses {
  setScope: ArchiveReadScope | null
  scope: ArchiveScopeLease | null
  dispose: null
  prune: null
  assert: null
  search: MailArchiveSearchHit[]
  get: MailArchiveMessage | null
  thread: MailArchiveThreadResult
  evidence: ArchiveEvidence[]
  resolve: ArchiveEvidenceResult
}
export type ArchivePluginResponse = ArchivePluginResponses[keyof ArchivePluginResponses]
