import type {
  MailArchiveGetRequest,
  MailArchiveMessage,
  MailArchiveSearchHit,
  MailArchiveSearchRequest,
  MailArchiveSource,
  MailArchiveSourceDeletion,
  MailArchiveSourceKind,
  MailArchiveThreadRequest,
  MailArchiveThreadResult,
  MailArchiveStats
} from '../../../../shared/mail-archive'
import type { NormalizedArchiveMail } from './types'
import type {
  ArchivePluginRequest,
  ArchivePluginResponse
} from '../../../../shared/mail-archive-plugin'
import type {
  MailArchiveAttachmentExportInput,
  MailArchiveAttachmentExportOutput,
  MailArchiveAttachmentLocation
} from './types'
import type { MailArchiveBatchCounts, MailArchiveRevisionStart } from './store'

export interface MailArchiveRevisionInput {
  readonly sourceId: string
  readonly sourceKind: MailArchiveSourceKind
  readonly sourcePath: string
  readonly fingerprint: string
}

export interface MailArchiveIndexWorker {
  pluginRequest?(input: ArchivePluginRequest): Promise<ArchivePluginResponse>
  openEpoch(epoch: string): Promise<void>
  revokeEpoch(epoch: string): Promise<void>
  beginRevision(input: MailArchiveRevisionInput): Promise<MailArchiveRevisionStart>
  upsertBatch(input: {
    readonly epoch: string
    readonly sourceId: string
    readonly revision: number
    readonly mails: readonly NormalizedArchiveMail[]
  }): Promise<MailArchiveBatchCounts>
  verifyRevision(
    sourceId: string,
    revision: number,
    fingerprint: string,
    epoch: string
  ): Promise<void>
  activateRevision(
    sourceId: string,
    revision: number,
    fingerprint: string,
    epoch: string
  ): Promise<void>
  abortRevision(sourceId: string, revision: number, state?: 'interrupted' | 'failed'): Promise<void>
  search(request: MailArchiveSearchRequest): Promise<MailArchiveSearchHit[]>
  get(request: MailArchiveGetRequest): Promise<MailArchiveMessage | null>
  thread(request: MailArchiveThreadRequest): Promise<MailArchiveThreadResult>
  attachmentLocation(attachmentId: string): Promise<MailArchiveAttachmentLocation | null>
  sourcePathInUse(path: string): Promise<boolean>
  sources(): Promise<MailArchiveSource[]>
  removeSource(sourceId: string): Promise<MailArchiveSourceDeletion | null>
  stats(): Promise<MailArchiveStats>
  close(): void
}

export interface MailArchiveSourceInput {
  readonly jobId: string
  readonly epoch: string
  readonly sourceId: string
  readonly sourcePath: string
  readonly sourceKind: MailArchiveSourceKind
}

export type MailArchiveSourceDecision =
  { readonly action: 'scan'; readonly revision: number } | { readonly action: 'skip' }

export interface MailArchiveSourceCallbacks {
  onReady(fingerprint: string): Promise<MailArchiveSourceDecision>
  onBatch(revision: number, mails: readonly NormalizedArchiveMail[]): Promise<void>
  onComplete(input: {
    readonly startFingerprint: string
    readonly endFingerprint: string
    readonly revision: number | null
    readonly ignoredItems?: number
    readonly messages: number
    readonly skipped: boolean
  }): Promise<void>
}

export interface MailArchiveSourceWorker {
  close(): void
  run(
    input: MailArchiveSourceInput,
    callbacks: MailArchiveSourceCallbacks,
    signal: AbortSignal
  ): Promise<void>
  extract(input: MailArchiveAttachmentExportInput): Promise<MailArchiveAttachmentExportOutput>
}

export interface MailArchiveWorkerFactory {
  createIndex(rootDir: string): MailArchiveIndexWorker
  createSource(): MailArchiveSourceWorker
}
