import { utilityProcess, type UtilityProcess } from 'electron'
import { randomUUID } from 'node:crypto'
import indexWorkerPath from './index-worker?modulePath'
import sourceWorkerPath from './source-worker?modulePath'
import type {
  MailArchiveIndexWorker,
  MailArchiveSourceCallbacks,
  MailArchiveSourceInput,
  MailArchiveSourceWorker,
  MailArchiveWorkerFactory
} from './worker-contract'
import type { MailArchiveAttachmentExportInput, MailArchiveAttachmentExportOutput } from './types'
import type { MailArchiveStore } from './store'

interface RpcResponse {
  readonly requestId: number
  readonly ok: boolean
  readonly value?: unknown
  readonly error?: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function workerError(value: unknown, fallback: string): Error {
  if (isRecord(value) && typeof value.error === 'string') return new Error(value.error)
  return new Error(fallback)
}

class IndexWorkerClient implements MailArchiveIndexWorker {
  private requestId = 0
  private closed = false
  private readonly pending = new Map<
    number,
    { resolve(value: unknown): void; reject(error: Error): void }
  >()
  private readonly ready: Promise<unknown>

  constructor(
    private readonly child: UtilityProcess,
    rootDir: string
  ) {
    child.on('message', (raw) => this.onMessage(raw))
    child.on('exit', () => this.rejectPending(new Error('mail_archive_index_worker_exited')))
    this.ready = this.requestRaw('init', rootDir)
    void this.ready.catch(() => undefined)
  }

  private onMessage(raw: unknown): void {
    if (!isRecord(raw) || typeof raw.requestId !== 'number') return
    const response = raw as unknown as RpcResponse
    const pending = this.pending.get(response.requestId)
    if (!pending) return
    this.pending.delete(response.requestId)
    if (response.ok) pending.resolve(response.value)
    else pending.reject(new Error(response.error ?? 'mail_archive_index_failed'))
  }

  private rejectPending(error: Error): void {
    for (const [, request] of this.pending) request.reject(error)
    this.pending.clear()
  }

  private requestRaw<T>(operation: string, payload?: unknown): Promise<T> {
    if (this.closed && operation !== 'close' && operation !== 'revokeEpoch') {
      return Promise.reject(new Error('mail_archive_index_worker_closed'))
    }
    const requestId = ++this.requestId
    return new Promise<T>((resolve, reject) => {
      this.pending.set(requestId, { resolve, reject })
      this.child.postMessage({ requestId, operation, payload })
    })
  }

  private request<T>(operation: string, payload?: unknown): Promise<T> {
    return this.ready.then(() => this.requestRaw<T>(operation, payload))
  }

  openEpoch(epoch: string): Promise<void> {
    return this.request('openEpoch', epoch)
  }

  revokeEpoch(epoch: string): Promise<void> {
    return this.request('revokeEpoch', epoch)
  }

  beginRevision(
    input: Parameters<MailArchiveStore['beginRevision']>[0]
  ): ReturnType<MailArchiveIndexWorker['beginRevision']> {
    return this.request<Awaited<ReturnType<MailArchiveStore['beginRevision']>>>(
      'beginRevision',
      input
    )
  }

  upsertBatch(
    input: Parameters<MailArchiveIndexWorker['upsertBatch']>[0]
  ): ReturnType<MailArchiveIndexWorker['upsertBatch']> {
    return this.request<Awaited<ReturnType<MailArchiveStore['upsertBatch']>>>('upsertBatch', input)
  }

  verifyRevision(
    sourceId: string,
    revision: number,
    fingerprint: string,
    epoch: string
  ): Promise<void> {
    return this.request('verifyRevision', { sourceId, revision, fingerprint, epoch })
  }

  activateRevision(
    sourceId: string,
    revision: number,
    fingerprint: string,
    epoch: string
  ): Promise<void> {
    return this.request('activateRevision', { sourceId, revision, fingerprint, epoch })
  }

  abortRevision(
    sourceId: string,
    revision: number,
    state: 'interrupted' | 'failed' = 'interrupted'
  ): Promise<void> {
    return this.request('abortRevision', { sourceId, revision, state })
  }

  search(
    request: Parameters<MailArchiveStore['search']>[0]
  ): ReturnType<MailArchiveIndexWorker['search']> {
    return this.request<Awaited<ReturnType<MailArchiveStore['search']>>>('search', request)
  }

  get(request: { id: string }): ReturnType<MailArchiveIndexWorker['get']> {
    return this.request<Awaited<ReturnType<MailArchiveStore['get']>>>('get', request)
  }

  thread(
    request: Parameters<MailArchiveStore['thread']>[0]
  ): ReturnType<MailArchiveIndexWorker['thread']> {
    return this.request<Awaited<ReturnType<MailArchiveStore['thread']>>>('thread', request)
  }

  attachmentLocation(
    attachmentId: string
  ): ReturnType<MailArchiveIndexWorker['attachmentLocation']> {
    return this.request<Awaited<ReturnType<MailArchiveStore['attachmentLocation']>>>(
      'attachmentLocation',
      { id: attachmentId }
    )
  }

  sourcePathInUse(path: string): ReturnType<MailArchiveIndexWorker['sourcePathInUse']> {
    return this.request<Awaited<ReturnType<MailArchiveStore['sourcePathInUse']>>>(
      'sourcePathInUse',
      { path }
    )
  }

  sources(): ReturnType<MailArchiveIndexWorker['sources']> {
    return this.request<Awaited<ReturnType<MailArchiveStore['sources']>>>('sources')
  }

  removeSource(sourceId: string): ReturnType<MailArchiveIndexWorker['removeSource']> {
    return this.request<Awaited<ReturnType<MailArchiveStore['removeSource']>>>('removeSource', {
      id: sourceId
    })
  }

  stats(): ReturnType<MailArchiveIndexWorker['stats']> {
    return this.request<Awaited<ReturnType<MailArchiveStore['stats']>>>('stats')
  }

  close(): void {
    if (this.closed) return
    this.closed = true
    void this.ready
      .then(() => this.requestRaw('close'))
      .catch(() => undefined)
      .finally(() => this.child.kill())
  }
}

class SourceWorkerClient implements MailArchiveSourceWorker {
  constructor(private readonly fork: (path: string, name: string) => UtilityProcess) {}

  run(
    input: MailArchiveSourceInput,
    callbacks: MailArchiveSourceCallbacks,
    signal: AbortSignal
  ): Promise<void> {
    signal.throwIfAborted()
    const child = this.fork(sourceWorkerPath, 'Orca Mail Archive Source')
    return new Promise<void>((resolve, reject) => {
      let settled = false
      let completionStarted = false
      const finish = (error?: Error): void => {
        if (settled) return
        settled = true
        signal.removeEventListener('abort', onAbort)
        if (error) reject(error)
        else resolve()
      }
      const fail = (error: Error): void => {
        child.kill()
        finish(error)
      }
      const onAbort = (): void => {
        child.postMessage({ type: 'cancel' })
        child.kill()
        finish(new Error('mail_import_cancelled'))
      }
      const onMessage = (raw: unknown): void => {
        if (!isRecord(raw) || typeof raw.type !== 'string' || settled) return
        if (raw.jobId !== input.jobId || raw.epoch !== input.epoch) {
          fail(new Error('mail_import_epoch_revoked'))
          return
        }
        if (raw.type === 'ready' && typeof raw.fingerprint === 'string') {
          void callbacks
            .onReady(raw.fingerprint)
            .then((decision) => child.postMessage({ type: 'decision', ...decision }))
            .catch((error: unknown) =>
              fail(error instanceof Error ? error : new Error('mail_revision_start_failed'))
            )
          return
        }
        if (
          raw.type === 'batch' &&
          typeof raw.batchId === 'number' &&
          typeof raw.revision === 'number' &&
          Array.isArray(raw.mails)
        ) {
          void callbacks
            .onBatch(
              raw.revision,
              raw.mails as Parameters<MailArchiveSourceCallbacks['onBatch']>[1]
            )
            .then(() => child.postMessage({ type: 'ack', batchId: raw.batchId as number }))
            .catch((error: unknown) =>
              fail(error instanceof Error ? error : new Error('mail_archive_batch_failed'))
            )
          return
        }
        if (raw.type === 'complete' && !completionStarted) {
          completionStarted = true
          void callbacks
            .onComplete({
              startFingerprint: String(raw.startFingerprint ?? ''),
              endFingerprint: String(raw.endFingerprint ?? ''),
              revision: typeof raw.revision === 'number' ? raw.revision : null,
              messages: typeof raw.messages === 'number' ? raw.messages : 0,
              skipped: raw.skipped === true
            })
            .then(() => {
              child.postMessage({ type: 'completeAck', ok: true })
              finish()
            })
            .catch((error: unknown) => {
              child.postMessage({ type: 'completeAck', ok: false })
              fail(
                error instanceof Error ? error : new Error('mail_archive_revision_verify_failed')
              )
            })
          return
        }
        if (raw.type === 'error') {
          fail(workerError(raw, 'mail_source_parse_failed'))
        }
      }
      child.on('message', onMessage)
      child.on('exit', (code) => {
        if (!settled)
          finish(
            new Error(code === 0 ? 'mail_source_worker_exited_early' : 'mail_source_worker_failed')
          )
      })
      signal.addEventListener('abort', onAbort, { once: true })
      child.postMessage({ type: 'start', ...input })
    })
  }

  extract(input: MailArchiveAttachmentExportInput): Promise<MailArchiveAttachmentExportOutput> {
    const child = this.fork(sourceWorkerPath, 'Orca Mail Archive Attachment Export')
    const requestId = randomUUID()
    return new Promise((resolve, reject) => {
      let settled = false
      const finish = (error?: Error, result?: MailArchiveAttachmentExportOutput): void => {
        if (settled) return
        settled = true
        if (error) reject(error)
        else if (result) resolve(result)
        else reject(new Error('mail_attachment_export_failed'))
      }
      child.on('message', (raw) => {
        if (!isRecord(raw) || raw.requestId !== requestId) return
        if (raw.type === 'extracted') {
          if (
            typeof raw.temporaryPath !== 'string' ||
            typeof raw.bytesWritten !== 'number' ||
            !Number.isSafeInteger(raw.bytesWritten) ||
            raw.bytesWritten < 0
          ) {
            child.kill()
            finish(new Error('mail_attachment_export_failed'))
            return
          }
          finish(undefined, {
            temporaryPath: raw.temporaryPath,
            bytesWritten: raw.bytesWritten
          })
          return
        }
        if (raw.type === 'extractError') {
          child.kill()
          finish(workerError(raw, 'mail_attachment_export_failed'))
        }
      })
      child.on('exit', (code) => {
        if (!settled)
          finish(
            new Error(
              code === 0 ? 'mail_attachment_worker_exited_early' : 'mail_attachment_worker_failed'
            )
          )
      })
      child.postMessage({ type: 'extract', requestId, input })
    })
  }
}

export function createMailArchiveWorkerFactory(): MailArchiveWorkerFactory {
  const fork = (path: string, serviceName: string): UtilityProcess =>
    utilityProcess.fork(path, [], { serviceName, stdio: 'ignore' })
  return {
    createIndex: (rootDir) =>
      new IndexWorkerClient(fork(indexWorkerPath, 'Orca Mail Archive Index'), rootDir),
    createSource: () => new SourceWorkerClient(fork)
  }
}
