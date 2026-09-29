import { createHash, randomUUID } from 'node:crypto'
import { createReadStream } from 'node:fs'
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
import { readEmlFile } from './readers/eml'
import { readPstFile } from './readers/pst'
import { createMailArchiveStore, type MailArchiveStore } from './store'

export interface MailArchiveService {
  import(
    request: MailArchiveImportRequest,
    onProgress?: (progress: MailArchiveProgress) => void
  ): Promise<MailArchiveImportResult>
  cancel(jobId: string): boolean
  search(request: MailArchiveSearchRequest): MailArchiveSearchHit[]
  get(request: MailArchiveGetRequest): MailArchiveMessage | null
  stats(): MailArchiveStats
  close(): void
}

interface ImportJob {
  readonly id: string
  readonly controller: AbortController
}

function errorReason(error: unknown): string {
  if (error instanceof Error && error.message) return error.message.slice(0, 300)
  return 'mail_import_failed'
}

async function fingerprint(path: string, signal: AbortSignal): Promise<string> {
  const hash = createHash('sha256')
  const stream = createReadStream(path)
  try {
    for await (const chunk of stream) {
      signal.throwIfAborted()
      hash.update(chunk as Buffer)
    }
    return hash.digest('hex')
  } finally {
    stream.destroy()
  }
}

export function createMailArchiveService(rootDir: string): MailArchiveService {
  const store = createMailArchiveStore(rootDir)
  let activeJob: ImportJob | null = null

  return {
    import: async (request, onProgress) => {
      if (activeJob) throw new Error('mail_import_already_running')
      const job: ImportJob = { id: randomUUID(), controller: new AbortController() }
      activeJob = job
      let sources = [] as Awaited<ReturnType<typeof resolveImportSources>>
      let processedFiles = 0
      let processedMessages = 0
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
          failedFiles: failures.length
        })
      }
      try {
        sources = await resolveImportSources(request.inputKind, request.paths)
        if (request.inputKind === 'eml-folder' && sources.length === 0) {
          throw new Error('eml_folder_empty')
        }
        emit('running', null)
        for (const source of sources) {
          job.controller.signal.throwIfAborted()
          emit('running', source.path)
          try {
            const sourceFingerprint = await fingerprint(source.path, job.controller.signal)
            if (source.kind === 'eml') {
              const message = await readEmlFile(
                source.path,
                sourceFingerprint,
                job.controller.signal
              )
              const result = store.upsert(message)
              processedMessages += 1
              if (result.inserted) insertedMessages += 1
              else skippedMessages += 1
            } else {
              await readPstFile({
                sourcePath: source.path,
                sourceFingerprint,
                signal: job.controller.signal,
                onMessage: (message) => {
                  const result = store.upsert(message)
                  processedMessages += 1
                  if (result.inserted) insertedMessages += 1
                  else skippedMessages += 1
                }
              })
            }
          } catch (error) {
            if (job.controller.signal.aborted) throw error
            failures.push({ path: basename(source.path), reason: errorReason(error) })
          }
          processedFiles += 1
          emit('running', source.path)
          // Yield after each source so a large batch leaves the renderer responsive and the cancel
          // IPC can run between files.
          await new Promise<void>((resolve) => setImmediate(resolve))
        }
        const result: MailArchiveImportResult = {
          jobId: job.id,
          state: 'completed',
          files: sources.length,
          messages: processedMessages,
          inserted: insertedMessages,
          skipped: skippedMessages,
          failures
        }
        emit('completed', null)
        return result
      } catch (error) {
        if (job.controller.signal.aborted) {
          const result: MailArchiveImportResult = {
            jobId: job.id,
            state: 'cancelled',
            files: sources.length,
            messages: processedMessages,
            inserted: insertedMessages,
            skipped: skippedMessages,
            failures
          }
          emit('cancelled', null)
          return result
        }
        throw error
      } finally {
        activeJob = null
      }
    },
    cancel: (jobId) => {
      if (!activeJob || activeJob.id !== jobId) return false
      activeJob.controller.abort()
      return true
    },
    search: (request) => store.search(request),
    get: (request) => store.get(request.id),
    stats: () => store.stats(),
    close: () => store.close()
  }
}

export type { MailArchiveStore }
