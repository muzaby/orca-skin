import { randomUUID } from 'node:crypto'
import { realpath, rename, unlink } from 'node:fs/promises'
import { basename, dirname, isAbsolute, resolve } from 'node:path'
import type {
  MailArchiveGetRequest,
  MailArchiveImportResult,
  MailArchiveProgress,
  MailArchiveSearchRequest,
  MailArchiveSearchHit,
  MailArchiveMessage,
  MailArchiveAttachmentExportResult,
  MailArchiveSource,
  MailArchiveSourceRemovalResult,
  MailArchiveThreadRequest,
  MailArchiveThreadResult,
  MailArchiveStats
} from '../../../../shared/mail-archive'
import { resolveImportSources } from './sources'
import { archiveSourceId } from './identity'
import { prepareEmlBatch } from './eml-batch'
import type { MailArchiveIndexWorker, MailArchiveWorkerFactory } from './worker-contract'
import type { MailArchiveSourceCallbacks } from './worker-contract'
import type {
  MailArchiveAttachmentExportInput,
  MailArchiveImportInput,
  MailArchiveEmlBatchItem,
  NormalizedArchiveMail
} from './types'

interface AttachmentExportChoice {
  readonly name: string
  readonly mimeType: string
  readonly sizeBytes: number
}

export interface MailArchiveService {
  import(
    request: MailArchiveImportInput,
    onProgress?: (progress: MailArchiveProgress) => void
  ): Promise<MailArchiveImportResult>
  /** Resolves after index commits/verification and cleanup. The producer may read its next batch meanwhile. */
  importEmlBatch(
    items: readonly MailArchiveEmlBatchItem[],
    onProgress?: (progress: MailArchiveProgress) => void
  ): Promise<MailArchiveImportResult>
  cancel(jobId: string): boolean
  search(request: MailArchiveSearchRequest): Promise<MailArchiveSearchHit[]>
  get(request: MailArchiveGetRequest): Promise<MailArchiveMessage | null>
  thread(request: MailArchiveThreadRequest): Promise<MailArchiveThreadResult>
  exportAttachment(
    attachmentId: string,
    chooseDestination: (attachment: AttachmentExportChoice) => Promise<string | null>
  ): Promise<MailArchiveAttachmentExportResult>
  sources(): Promise<MailArchiveSource[]>
  removeSource(sourceId: string): Promise<MailArchiveSourceRemovalResult>
  stats(): Promise<MailArchiveStats>
  close(): void
}

interface ImportJob {
  readonly id: string
  readonly sourcesReady: Promise<void>
  readonly markSourcesReady: () => void
  readonly controller: AbortController
  epoch: string
  revokePromise?: Promise<void>
  sourceIds: Set<string>
  finalizing: boolean
  readonly settled: Promise<void>
  readonly settle: () => void
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

async function consumePreprocessedEml(
  mail: NormalizedArchiveMail,
  callbacks: MailArchiveSourceCallbacks,
  signal: AbortSignal
): Promise<void> {
  signal.throwIfAborted()
  const decision = await callbacks.onReady(mail.sourceFingerprint)
  signal.throwIfAborted()
  if (decision.action === 'scan') await callbacks.onBatch(decision.revision, [mail])
  signal.throwIfAborted()
  await callbacks.onComplete({
    startFingerprint: mail.sourceFingerprint,
    endFingerprint: mail.sourceFingerprint,
    revision: decision.action === 'scan' ? decision.revision : null,
    messages: decision.action === 'scan' ? 1 : 0,
    skipped: decision.action === 'skip'
  })
}

async function canonicalDestination(path: string): Promise<string> {
  const absolute = resolve(path)
  try {
    return await realpath(absolute)
  } catch {
    const parent = await realpath(dirname(absolute)).catch(() => dirname(absolute))
    return resolve(parent, basename(absolute))
  }
}

export function createMailArchiveService(
  rootDir: string,
  workers: MailArchiveWorkerFactory
): MailArchiveService {
  const index = workers.createIndex(rootDir)
  const sourceWorker = workers.createSource()
  let latestProgress: MailArchiveProgress | null = null
  let lastImport: MailArchiveImportResult | null = null
  let activeJob: ImportJob | null = null
  let closed = false
  let sourceRemovalsPending = 0
  let sourceRemovalQueue = Promise.resolve()
  let activeAttachmentExports = 0
  const attachmentExportsIdle = new Set<() => void>()

  const waitForAttachmentExports = (): Promise<void> => {
    if (activeAttachmentExports === 0) return Promise.resolve()
    return new Promise((resolveIdle) => attachmentExportsIdle.add(resolveIdle))
  }

  const releaseAttachmentExport = (): void => {
    activeAttachmentExports -= 1
    if (activeAttachmentExports !== 0) return
    for (const resolveIdle of attachmentExportsIdle) resolveIdle()
    attachmentExportsIdle.clear()
  }

  const importArchive = async (
    request:
      | MailArchiveImportInput
      | { inputKind: 'eml-batch'; items: readonly MailArchiveEmlBatchItem[] },
    onProgress?: (progress: MailArchiveProgress) => void
  ): Promise<MailArchiveImportResult> => {
    if (closed) throw new Error('mail_archive_service_closed')
    if (sourceRemovalsPending > 0) throw new Error('mail_source_remove_in_progress')
    if (activeJob) throw new Error('mail_import_already_running')
    const prepared = request.inputKind === 'eml-batch' ? prepareEmlBatch(request.items) : null
    const preparedByPath = new Map(prepared?.map((mail) => [mail.sourcePath, mail]))
    let settle!: () => void
    const settled = new Promise<void>((resolve) => {
      settle = resolve
    })
    let markSourcesReady!: () => void
    const sourcesReady = new Promise<void>((r) => {
      markSourcesReady = r
    })
    const job: ImportJob = {
      sourcesReady,
      markSourcesReady,
      id: randomUUID(),
      controller: new AbortController(),
      epoch: randomUUID(),
      sourceIds: new Set(),
      finalizing: false,
      settled,
      settle
    }
    activeJob = job
    const importEpoch = job.epoch
    let sources = [] as Awaited<ReturnType<typeof resolveImportSources>>
    let processedFiles = 0
    let processedMessages = 0
    let completedMessages = 0
    let ignoredItems = 0
    let insertedMessages = 0
    let skippedMessages = 0
    const failures: { path: string; reason: string }[] = []
    lastImport = null
    let lastEventAt = -Infinity
    const emit = (state: MailArchiveProgress['state'], currentPath: string | null): void => {
      latestProgress = {
        jobId: job.id,
        state,
        currentPath,
        processedFiles,
        totalFiles: sources.length,
        processedMessages,
        insertedMessages,
        skippedMessages,
        failedFiles: failures.length,
        cancellable: state === 'running' && !job.finalizing && !job.controller.signal.aborted
      }
      if (state !== 'running' || Date.now() - lastEventAt >= 250) {
        lastEventAt = Date.now()
        onProgress?.(latestProgress)
      }
    }
    const assertCurrent = (expectedEpoch = job.epoch): void => {
      job.controller.signal.throwIfAborted()
      if (activeJob !== job || job.epoch !== expectedEpoch) {
        throw new Error('mail_import_epoch_revoked')
      }
    }

    try {
      emit('running', null)
      await index.openEpoch(importEpoch)
      sources =
        request.inputKind === 'eml-batch'
          ? [...preparedByPath.values()].map((mail) => ({
              kind: 'eml' as const,
              path: mail.sourcePath
            }))
          : await resolveImportSources(request.inputKind, request.paths, job.controller.signal)
      job.sourceIds = new Set(sources.map((source) => archiveSourceId(source.kind, source.path)))
      job.markSourcesReady()
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
          const callbacks: MailArchiveSourceCallbacks = {
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
                await index.activateRevision(sourceId, revision, revisionFingerprint, sourceEpoch)
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
              ignoredItems += completion.ignoredItems ?? 0
              completedMessages += sourceMessages
              insertedMessages += sourceInserted
              skippedMessages += sourceSkipped
            }
          }
          const preprocessed = preparedByPath.get(sourcePath)
          if (preprocessed) {
            await consumePreprocessedEml(preprocessed, callbacks, job.controller.signal)
          } else {
            await sourceWorker.run(
              { jobId: job.id, epoch: sourceEpoch, sourceId, sourcePath, sourceKind: source.kind },
              callbacks,
              job.controller.signal
            )
          }
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
        ignoredItems,
        inserted: insertedMessages,
        skipped: skippedMessages,
        failures
      }
      job.finalizing = true
      emit('completed', null)
      lastImport = result
      return result
    } catch (error) {
      if (job.controller.signal.aborted) {
        emit('cancelled', null)
        lastImport = cancelledResult(
          job.id,
          processedFiles,
          completedMessages,
          insertedMessages,
          skippedMessages,
          failures
        )
        return lastImport
      }
      latestProgress = null
      throw error
    } finally {
      job.markSourcesReady()
      if (job.epoch) {
        const epoch = job.epoch
        job.epoch = ''
        job.revokePromise = index.revokeEpoch(epoch).catch(() => undefined)
      }
      await job.revokePromise
      if (activeJob === job) activeJob = null
      if (!prepared) sourceWorker.close()
      job.settle()
    }
  }
  return {
    import: importArchive,
    importEmlBatch: (items, onProgress) =>
      importArchive({ inputKind: 'eml-batch', items }, onProgress),
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
    thread: (request) => index.thread(request),
    exportAttachment: async (attachmentId, chooseDestination) => {
      if (closed) throw new Error('mail_archive_service_closed')
      if (sourceRemovalsPending > 0) throw new Error('mail_archive_source_removing')
      activeAttachmentExports += 1
      let temporaryPath: string | undefined
      try {
        const location = await index.attachmentLocation(attachmentId)
        if (!location) return { state: 'not-found' }
        const destinationPath = await chooseDestination({
          name: location.name,
          mimeType: location.mimeType,
          sizeBytes: location.sizeBytes
        })
        if (!destinationPath) return { state: 'cancelled' }
        if (!isAbsolute(destinationPath)) throw new Error('mail_attachment_destination_invalid')
        const targetPath = resolve(destinationPath)
        if (await index.sourcePathInUse(await canonicalDestination(targetPath))) {
          throw new Error('mail_attachment_destination_is_source')
        }
        const input: MailArchiveAttachmentExportInput = { ...location, destinationPath: targetPath }
        const extracted = await sourceWorker.extract(input)
        temporaryPath = extracted.temporaryPath
        if (
          dirname(resolve(temporaryPath)) !== dirname(targetPath) ||
          !basename(temporaryPath).endsWith('.orca-part') ||
          extracted.bytesWritten !== location.sizeBytes
        ) {
          throw new Error('mail_attachment_export_invalid')
        }
        const current = await index.attachmentLocation(attachmentId)
        if (
          !current ||
          current.sourceId !== location.sourceId ||
          current.sourceFingerprint !== location.sourceFingerprint ||
          current.itemKey !== location.itemKey
        ) {
          throw new Error('mail_attachment_source_changed')
        }
        await rename(temporaryPath, targetPath)
        temporaryPath = undefined
        return { state: 'exported', name: location.name, sizeBytes: extracted.bytesWritten }
      } finally {
        if (temporaryPath) await unlink(temporaryPath).catch(() => undefined)
        releaseAttachmentExport()
      }
    },
    sources: () => index.sources(),
    removeSource: async (sourceId) => {
      sourceRemovalsPending += 1
      let release!: () => void
      const previous = sourceRemovalQueue
      sourceRemovalQueue = new Promise<void>((resolve) => {
        release = resolve
      })
      await previous
      try {
        const sources = await index.sources()
        if (!sources.some((source) => source.id === sourceId)) return { state: 'not-found' }

        const job = activeJob
        await job?.sourcesReady
        const importCancelled = job?.sourceIds.has(sourceId) === true
        if (job && importCancelled) {
          const epoch = job.epoch
          job.epoch = ''
          job.controller.abort()
          if (epoch) job.revokePromise = index.revokeEpoch(epoch).catch(() => undefined)
          await job.settled
        }

        await waitForAttachmentExports()
        const removed = await index.removeSource(sourceId)
        return removed ? { state: 'removed', ...removed, importCancelled } : { state: 'not-found' }
      } finally {
        sourceRemovalsPending -= 1
        release()
      }
    },
    stats: async () => ({ ...(await index.stats()), progress: latestProgress, lastImport }),
    close: () => {
      if (closed) return
      closed = true
      if (activeJob) {
        const epoch = activeJob.epoch
        activeJob.epoch = ''
        activeJob.controller.abort()
        if (epoch) activeJob.revokePromise = index.revokeEpoch(epoch).catch(() => undefined)
      }
      sourceWorker.close()
      index.close()
    }
  }
}

export type { MailArchiveIndexWorker }
