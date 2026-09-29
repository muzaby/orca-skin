import { randomUUID } from 'node:crypto'
import { basename } from 'node:path'
import type {
  MailArchiveGetRequest,
  MailArchiveImportRequest,
  MailArchiveImportResult,
  MailArchiveProgress,
  MailArchiveSearchRequest,
  MailArchiveSearchHit,
  MailArchiveMessage,
  MailArchiveStats
} from '../../../../shared/mail-archive'
import { resolveImportSources } from './sources'
import { archiveSourceId } from './identity'
import type { MailArchiveIndexWorker, MailArchiveWorkerFactory } from './worker-contract'

export interface MailArchiveService {
  import(
    request: MailArchiveImportRequest,
    onProgress?: (progress: MailArchiveProgress) => void
  ): Promise<MailArchiveImportResult>
  cancel(jobId: string): boolean
  search(request: MailArchiveSearchRequest): Promise<MailArchiveSearchHit[]>
  get(request: MailArchiveGetRequest): Promise<MailArchiveMessage | null>
  stats(): Promise<MailArchiveStats>
  close(): void
}

interface ImportJob {
  readonly id: string
  readonly controller: AbortController
  epoch: string
  revokePromise?: Promise<void>
  finalizing: boolean
}

function errorReason(error: unknown): string {
  if (error instanceof Error && /^[a-z0-9_:-]{1,160}$/i.test(error.message)) return error.message
  return 'mail_import_failed'
}

function cancelledResult(
  jobId: string,
  files: number,
  messages: number,
  inserted: number,
  skipped: number,
  failures: readonly { path: string; reason: string }[]
): MailArchiveImportResult {
  return { jobId, state: 'cancelled', files, messages, inserted, skipped, failures }
}

export function createMailArchiveService(
  rootDir: string,
  workers: MailArchiveWorkerFactory
): MailArchiveService {
  const index = workers.createIndex(rootDir)
  const sourceWorker = workers.createSource()
  let activeJob: ImportJob | null = null
  let closed = false

  return {
    import: async (request, onProgress) => {
      if (closed) throw new Error('mail_archive_service_closed')
      if (activeJob) throw new Error('mail_import_already_running')
      const job: ImportJob = {
        id: randomUUID(),
        controller: new AbortController(),
        epoch: randomUUID(),
        finalizing: false
      }
      activeJob = job
      const importEpoch = job.epoch
      let sources = [] as Awaited<ReturnType<typeof resolveImportSources>>
      let processedFiles = 0
      let processedMessages = 0
      let completedMessages = 0
      let insertedMessages = 0
      let skippedMessages = 0
      const failures: { path: string; reason: string }[] = []
      const emit = (state: MailArchiveProgress['state'], currentPath: string | null): void => {
        onProgress?.({
          jobId: job.id,
          state,
          currentPath,
          processedFiles,
          totalFiles: sources.length,
          processedMessages,
          insertedMessages,
          skippedMessages,
          failedFiles: failures.length,
          cancellable: state === 'running' && !job.finalizing && processedFiles < sources.length
        })
      }
      const assertCurrent = (expectedEpoch = job.epoch): void => {
        job.controller.signal.throwIfAborted()
        if (activeJob !== job || job.epoch !== expectedEpoch) {
          throw new Error('mail_import_epoch_revoked')
        }
      }

      try {
        await index.openEpoch(importEpoch)
        sources = await resolveImportSources(request.inputKind, request.paths)
        if (request.inputKind === 'eml-folder' && sources.length === 0) {
          throw new Error('eml_folder_empty')
        }
        emit('running', null)
        for (const source of sources) {
          assertCurrent()
          const sourcePath = source.path
          const currentLabel = basename(source.path)
          const sourceId = archiveSourceId(source.kind, sourcePath)
          const sourceEpoch = job.epoch
          let revision: number | null = null
          let revisionFingerprint = ''
          let sourceUnchanged = false
          let existingMessages = 0
          let sourceMessages = 0
          let sourceInserted = 0
          let sourceSkipped = 0
          emit('running', currentLabel)
          try {
            await sourceWorker.run(
              { jobId: job.id, epoch: sourceEpoch, sourceId, sourcePath, sourceKind: source.kind },
              {
                onReady: async (fingerprint) => {
                  assertCurrent(sourceEpoch)
                  revisionFingerprint = fingerprint
                  const started = await index.beginRevision({
                    sourceId,
                    sourceKind: source.kind,
                    sourcePath,
                    fingerprint
                  })
                  revision = started.revision
                  assertCurrent(sourceEpoch)
                  if (started.unchanged) {
                    sourceUnchanged = true
                    existingMessages = started.existingMessages
                    return { action: 'skip' }
                  }
                  return { action: 'scan', revision: started.revision }
                },
                onBatch: async (batchRevision, mails) => {
                  assertCurrent(sourceEpoch)
                  if (revision === null || batchRevision !== revision) {
                    throw new Error('mail_import_epoch_revoked')
                  }
                  const result = await index.upsertBatch({
                    epoch: sourceEpoch,
                    sourceId,
                    revision,
                    mails
                  })
                  assertCurrent(sourceEpoch)
                  sourceMessages += mails.length
                  sourceInserted += result.inserted
                  sourceSkipped += result.skipped
                  processedMessages += mails.length
                  emit('running', currentLabel)
                },
                onComplete: async (completion) => {
                  assertCurrent(sourceEpoch)
                  if (
                    completion.startFingerprint !== revisionFingerprint ||
                    completion.endFingerprint !== revisionFingerprint
                  ) {
                    throw new Error('mail_source_changed_during_import')
                  }
                  if (sourceUnchanged) {
                    if (completion.revision !== null || completion.messages !== 0) {
                      throw new Error('mail_archive_unchanged_revision_invalid')
                    }
                    job.finalizing = true
                    if (!completion.skipped || revision === null) {
                      throw new Error('mail_archive_unchanged_revision_invalid')
                    }
                    await index.activateRevision(
                      sourceId,
                      revision,
                      revisionFingerprint,
                      sourceEpoch
                    )
                    assertCurrent(sourceEpoch)
                    completedMessages += existingMessages
                    processedMessages += existingMessages
                    skippedMessages += existingMessages
                    return
                  }
                  if (revision === null || completion.skipped || completion.revision !== revision) {
                    throw new Error('mail_archive_revision_invalid')
                  }
                  if (completion.messages !== sourceMessages) {
                    throw new Error('mail_archive_batch_count_mismatch')
                  }
                  job.finalizing = true
                  await index.verifyRevision(sourceId, revision, revisionFingerprint, sourceEpoch)
                  assertCurrent(sourceEpoch)
                  completedMessages += sourceMessages
                  insertedMessages += sourceInserted
                  skippedMessages += sourceSkipped
                }
              },
              job.controller.signal
            )
          } catch (error) {
            if (revision !== null) {
              await index
                .abortRevision(
                  sourceId,
                  revision,
                  job.controller.signal.aborted ? 'interrupted' : 'failed'
                )
                .catch(() => undefined)
            }
            if (job.controller.signal.aborted) throw error
            failures.push({ path: currentLabel, reason: errorReason(error) })
          }
          processedFiles += 1
          job.finalizing = processedFiles >= sources.length
          emit('running', currentLabel)
          // Let IPC cancellation and progress events run between source files.
          await new Promise<void>((resolve) => setImmediate(resolve))
        }
        assertCurrent()
        const result: MailArchiveImportResult = {
          jobId: job.id,
          state: 'completed',
          files: sources.length,
          messages: completedMessages,
          inserted: insertedMessages,
          skipped: skippedMessages,
          failures
        }
        job.finalizing = true
        emit('completed', null)
        return result
      } catch (error) {
        if (job.controller.signal.aborted) {
          emit('cancelled', null)
          return cancelledResult(
            job.id,
            processedFiles,
            completedMessages,
            insertedMessages,
            skippedMessages,
            failures
          )
        }
        throw error
      } finally {
        if (job.epoch) {
          const epoch = job.epoch
          job.epoch = ''
          job.revokePromise = index.revokeEpoch(epoch).catch(() => undefined)
        }
        await job.revokePromise
        if (activeJob === job) activeJob = null
      }
    },
    cancel: (jobId) => {
      if (!activeJob || activeJob.id !== jobId || activeJob.finalizing) return false
      const epoch = activeJob.epoch
      activeJob.epoch = ''
      activeJob.controller.abort()
      activeJob.revokePromise = index.revokeEpoch(epoch).catch(() => undefined)
      return true
    },
    search: (request) => index.search(request),
    get: (request) => index.get(request),
    stats: () => index.stats(),
    close: () => {
      if (closed) return
      closed = true
      if (activeJob) {
        const epoch = activeJob.epoch
        activeJob.epoch = ''
        activeJob.controller.abort()
        if (epoch) activeJob.revokePromise = index.revokeEpoch(epoch).catch(() => undefined)
      }
      index.close()
    }
  }
}

export type { MailArchiveIndexWorker }
