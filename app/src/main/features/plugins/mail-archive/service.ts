import { randomUUID } from 'node:crypto'
import { realpath, rename, unlink } from 'node:fs/promises'
import { basename, dirname, isAbsolute, resolve } from 'node:path'
import type {
  MailArchiveAttachmentExportResult,
  MailArchiveImportFailure,
  MailArchiveImportResult,
  MailArchiveMessage,
  MailArchiveProgress,
  MailArchiveSearchHit,
  MailArchiveSearchRequest,
  MailArchiveSource,
  MailArchiveSourceRemovalResult,
  MailArchiveStats,
  MailArchiveThreadRequest,
  MailArchiveThreadResult
} from '../../../../shared/mail-archive'
import { archiveErrorCode } from './errors'
import type { MailArchiveIndex } from './index-operations'
import { resolveImportSources } from './sources'
import type { ArchiveImportSource, MailArchiveImportRequest } from './types'
import type { MailArchiveSourceWorker } from './worker-contract'

export interface MailArchiveService {
  import(
    request: MailArchiveImportRequest,
    onProgress?: (progress: MailArchiveProgress) => void
  ): Promise<MailArchiveImportResult>
  /** 진행 중 작업의 마지막 상태. 화면을 다시 열었을 때 복구한다. */
  progress(): MailArchiveProgress | null
  cancel(jobId: string): boolean
  search(request: MailArchiveSearchRequest): Promise<MailArchiveSearchHit[]>
  get(id: string): Promise<MailArchiveMessage | null>
  thread(request: MailArchiveThreadRequest): Promise<MailArchiveThreadResult>
  exportAttachment(
    attachmentId: string,
    chooseDestination: (attachment: { name: string }) => Promise<string | null>
  ): Promise<MailArchiveAttachmentExportResult>
  sources(): Promise<MailArchiveSource[]>
  removeSource(sourceId: string): Promise<MailArchiveSourceRemovalResult>
  stats(): Promise<MailArchiveStats>
  close(): void
}

interface ImportJob {
  readonly id: string
  readonly controller: AbortController
  readonly sourceIds: Set<string>
  /** 비면 폐기된 작업이다. index는 이 값이 없는 batch·검증을 거절한다. */
  epoch: string
  finalizing: boolean
  progress: MailArchiveProgress | null
  settled: Promise<void>
}

async function canonicalDestination(path: string): Promise<string> {
  return realpath(path).catch(async () =>
    resolve(await realpath(dirname(path)).catch(() => dirname(path)), basename(path))
  )
}

export function createMailArchiveService(workers: {
  readonly index: MailArchiveIndex
  readonly source: MailArchiveSourceWorker
}): MailArchiveService {
  const { index, source: sourceWorker } = workers
  let activeJob: ImportJob | null = null
  let closed = false
  let removalsPending = 0
  let removalQueue: Promise<unknown> = Promise.resolve()
  const exports = new Set<Promise<unknown>>()

  /** 작업을 멈추고 epoch를 폐기한다. 이후 도착하는 batch·검증은 index가 거절한다. */
  const revoke = (job: ImportJob, abort: boolean): Promise<void> => {
    if (abort) job.controller.abort()
    if (!job.epoch) return Promise.resolve()
    const epoch = job.epoch
    job.epoch = ''
    return index.revokeEpoch(epoch).catch(() => undefined)
  }

  const importSources = async (
    job: ImportJob,
    sources: readonly ArchiveImportSource[],
    onProgress?: (progress: MailArchiveProgress) => void
  ): Promise<MailArchiveImportResult> => {
    const epoch = job.epoch
    const totalFiles = sources.reduce((sum, source) => sum + source.files.length, 0)
    const failures: MailArchiveImportFailure[] = []
    let processedFiles = 0
    let processedMessages = 0
    let insertedMessages = 0
    let skippedMessages = 0
    let verified = false
    const emit = (state: MailArchiveProgress['state'], currentPath: string | null): void => {
      job.progress = {
        jobId: job.id,
        state,
        currentPath,
        processedFiles,
        totalFiles,
        processedMessages,
        insertedMessages,
        skippedMessages,
        cancellable: state === 'running' && !job.finalizing
      }
      onProgress?.(job.progress)
    }
    const assertCurrent = (): void => {
      job.controller.signal.throwIfAborted()
      if (job.epoch !== epoch) throw new Error('mail_import_epoch_revoked')
    }

    try {
      emit('running', null)
      for (const source of sources) {
        for (const file of source.files) {
          assertCurrent()
          const label = basename(file.path)
          let revision: number | null = null
          let fingerprint = ''
          let existing = 0
          let messages = 0
          let inserted = 0
          let skipped = 0
          emit('running', label)
          try {
            const completion = await sourceWorker.run(
              { jobId: job.id, epoch, sourceId: source.sourceId, sourceKind: source.kind, ...file },
              {
                ready: async (readyFingerprint) => {
                  assertCurrent()
                  fingerprint = readyFingerprint
                  const started = await index.beginRevision({
                    sourceId: source.sourceId,
                    sourceKind: source.kind,
                    sourcePath: source.root,
                    fingerprint
                  })
                  if (started.unchanged) {
                    existing = started.existingMessages
                    return { action: 'skip' }
                  }
                  revision = started.revision
                  assertCurrent()
                  return { action: 'scan', revision: started.revision }
                },
                batch: async (batchRevision, mails) => {
                  assertCurrent()
                  if (batchRevision !== revision) throw new Error('mail_import_epoch_revoked')
                  const counts = await index.upsertBatch({
                    epoch,
                    sourceId: source.sourceId,
                    revision: batchRevision,
                    mails
                  })
                  messages += mails.length
                  inserted += counts.inserted
                  skipped += counts.skipped
                  processedMessages += mails.length
                  emit('running', label)
                }
              },
              job.controller.signal
            )
            if (completion.skipped) {
              processedMessages += existing
              skippedMessages += existing
            } else {
              if (
                completion.revision !== revision ||
                completion.messages !== messages ||
                revision === null
              ) {
                throw new Error('mail_archive_batch_count_mismatch')
              }
              job.finalizing = true
              await index.verifyRevision({
                epoch,
                sourceId: source.sourceId,
                revision,
                fingerprint
              })
              verified = true
              insertedMessages += inserted
              skippedMessages += skipped
              for (const warning of completion.warnings)
                failures.push({ path: label, reason: warning })
            }
          } catch (error) {
            if (revision !== null) {
              await index
                .abortRevision({ sourceId: source.sourceId, revision })
                .catch(() => undefined)
            }
            if (job.controller.signal.aborted) throw error
            failures.push({ path: label, reason: archiveErrorCode(error, 'mail_import_failed') })
          } finally {
            job.finalizing = false
          }
          processedFiles += 1
          emit('running', label)
        }
      }
      assertCurrent()
      emit('completed', null)
      return {
        jobId: job.id,
        state: 'completed',
        messages: processedMessages,
        inserted: insertedMessages,
        skipped: skippedMessages,
        failures
      }
    } catch (error) {
      if (!job.controller.signal.aborted) throw error
      emit('cancelled', null)
      return {
        jobId: job.id,
        state: 'cancelled',
        messages: processedMessages,
        inserted: insertedMessages,
        skipped: skippedMessages,
        failures
      }
    } finally {
      // 관계는 보이는 메일 전체에서 한 번 다시 계산한다. 파일마다 하면 가져오기가 O(N²)이 된다.
      if (verified) await index.refreshRelations().catch(() => undefined)
    }
  }

  return {
    import: async (request, onProgress) => {
      if (closed) throw new Error('mail_archive_service_closed')
      if (removalsPending > 0) throw new Error('mail_source_remove_in_progress')
      if (activeJob) throw new Error('mail_import_already_running')
      let settle!: () => void
      const job: ImportJob = {
        id: randomUUID(),
        controller: new AbortController(),
        sourceIds: new Set(),
        epoch: randomUUID(),
        finalizing: false,
        progress: null,
        settled: new Promise<void>((resolve) => (settle = resolve))
      }
      activeJob = job
      try {
        await index.openEpoch(job.epoch)
        const sources = await resolveImportSources(request)
        for (const source of sources) job.sourceIds.add(source.sourceId)
        return await importSources(job, sources, onProgress)
      } finally {
        await revoke(job, false)
        sourceWorker.dispose()
        activeJob = null
        settle()
      }
    },

    progress: () => activeJob?.progress ?? null,

    cancel: (jobId) => {
      if (activeJob?.id !== jobId || activeJob.finalizing) return false
      void revoke(activeJob, true)
      return true
    },

    search: (request) => index.search(request),
    get: (id) => index.get(id),
    thread: (request) => index.thread(request),

    exportAttachment: (attachmentId, chooseDestination) => {
      if (closed) return Promise.reject(new Error('mail_archive_service_closed'))
      if (removalsPending > 0) return Promise.reject(new Error('mail_archive_source_removing'))
      const task = (async (): Promise<MailArchiveAttachmentExportResult> => {
        const location = await index.attachmentLocation(attachmentId)
        if (!location) return { state: 'not-found' }
        const destination = await chooseDestination({ name: location.name })
        if (!destination) return { state: 'cancelled' }
        if (!isAbsolute(destination)) throw new Error('mail_attachment_destination_invalid')
        const targetPath = resolve(destination)
        if (await index.sourcePathInUse(await canonicalDestination(targetPath))) {
          throw new Error('mail_attachment_destination_is_source')
        }
        const extracted = await sourceWorker.extract({ ...location, destinationPath: targetPath })
        try {
          if (
            dirname(resolve(extracted.temporaryPath)) !== dirname(targetPath) ||
            !basename(extracted.temporaryPath).endsWith('.orca-part') ||
            extracted.bytesWritten !== location.sizeBytes
          ) {
            throw new Error('mail_attachment_export_invalid')
          }
          // 추출하는 동안 자료원이 제거·교체되지 않았는지 다시 확인한 뒤에만 파일을 내놓는다.
          const current = await index.attachmentLocation(attachmentId)
          if (current?.sourceFingerprint !== location.sourceFingerprint) {
            throw new Error('mail_attachment_source_changed')
          }
          await rename(extracted.temporaryPath, targetPath)
        } catch (error) {
          await unlink(extracted.temporaryPath).catch(() => undefined)
          throw error
        }
        return { state: 'exported', name: location.name, sizeBytes: extracted.bytesWritten }
      })()
      exports.add(task)
      void task.catch(() => undefined).finally(() => exports.delete(task))
      return task
    },

    sources: () => index.sources(),

    removeSource: (sourceId) => {
      removalsPending += 1
      const removal = removalQueue.then(async (): Promise<MailArchiveSourceRemovalResult> => {
        const job = activeJob
        // 이 자료원을 가져오는 중일 때만 멈춘다. 다른 자료원의 가져오기는 계속된다.
        const importCancelled = job !== null && job.sourceIds.has(sourceId)
        if (job && importCancelled) {
          await revoke(job, true)
          await job.settled
        }
        await Promise.allSettled([...exports])
        const removed = await index.removeSource(sourceId)
        return removed ? { state: 'removed', ...removed, importCancelled } : { state: 'not-found' }
      })
      removalQueue = removal.catch(() => undefined).finally(() => (removalsPending -= 1))
      return removal
    },

    stats: () => index.stats(),

    close: () => {
      if (closed) return
      closed = true
      if (activeJob) void revoke(activeJob, true)
      sourceWorker.dispose()
      void index.close().catch(() => undefined)
    }
  }
}
