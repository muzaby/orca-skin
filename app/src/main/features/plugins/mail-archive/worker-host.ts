import { utilityProcess, type UtilityProcess } from 'electron'
import { randomUUID } from 'node:crypto'
import indexWorkerPath from './index-worker?modulePath'
import sourceWorkerPath from './source-worker?modulePath'
import {
  createIndexOperations,
  type IndexOperationName,
  type MailArchiveIndex
} from './index-operations'
import type { MailArchiveAttachmentExportInput, MailArchiveAttachmentExportOutput } from './types'
import type {
  MailArchiveSourceChannel,
  MailArchiveSourceCompletion,
  MailArchiveSourceInput,
  MailArchiveSourceWorker
} from './worker-contract'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function asError(value: unknown, fallback: string): Error {
  return value instanceof Error ? value : new Error(fallback)
}

function fork(path: string, serviceName: string, env?: Record<string, string>): UtilityProcess {
  return utilityProcess.fork(path, [], {
    serviceName,
    stdio: 'ignore',
    ...(env ? { env: { ...process.env, ...env } } : {})
  })
}

const INDEX_OPERATIONS = Object.keys(
  createIndexOperations(() => {
    throw new Error('mail_archive_index_names_only')
  })
) as IndexOperationName[]

/**
 * index utility process RPC. 처음 요청할 때 띄우고, 죽으면 대기 요청을 실패시킨 뒤 다음 요청에서
 * 다시 띄운다 — 워커 한 번의 종료가 앱 재시작 전까지 보관함 전체를 멈추지 않는다.
 */
function createIndexClient(rootDir: string): MailArchiveIndex {
  let child: UtilityProcess | null = null
  let nextRequestId = 0
  const pending = new Map<number, { resolve(value: unknown): void; reject(error: Error): void }>()

  const startWorker = (): UtilityProcess => {
    const worker = fork(indexWorkerPath, 'Orca Mail Archive Index', {
      ORCA_MAIL_ARCHIVE_ROOT: rootDir
    })
    worker.on('message', (raw: unknown) => {
      if (!isRecord(raw) || typeof raw.requestId !== 'number') return
      const request = pending.get(raw.requestId)
      if (!request) return
      pending.delete(raw.requestId)
      if (raw.ok === true) request.resolve(raw.value)
      else
        request.reject(
          new Error(typeof raw.error === 'string' ? raw.error : 'mail_archive_index_failed')
        )
    })
    worker.on('exit', () => {
      if (child === worker) child = null
      for (const request of pending.values()) {
        request.reject(new Error('mail_archive_index_worker_exited'))
      }
      pending.clear()
    })
    return worker
  }

  const call = (operation: IndexOperationName, payload: unknown): Promise<unknown> =>
    new Promise((resolve, reject) => {
      if (operation === 'close' && !child) return resolve(undefined)
      const target = child ?? (child = startWorker())
      const requestId = ++nextRequestId
      pending.set(requestId, { resolve, reject })
      target.postMessage({ requestId, operation, payload })
    })

  return Object.fromEntries(
    INDEX_OPERATIONS.map((operation) => [
      operation,
      (payload?: unknown) => call(operation, payload)
    ])
  ) as MailArchiveIndex
}

/** source utility process. 한 가져오기 작업 동안 재사용하고 작업이 끝나면 내린다. */
class SourceWorkerClient implements MailArchiveSourceWorker {
  private child: UtilityProcess | null = null

  run(
    input: MailArchiveSourceInput,
    channel: MailArchiveSourceChannel,
    signal: AbortSignal
  ): Promise<MailArchiveSourceCompletion> {
    signal.throwIfAborted()
    const child = this.child ?? (this.child = fork(sourceWorkerPath, 'Orca Mail Archive Source'))
    return new Promise((resolve, reject) => {
      let settled = false
      const finish = (error: Error | null, completion?: MailArchiveSourceCompletion): void => {
        if (settled) return
        settled = true
        child.off('message', onMessage)
        child.off('exit', onExit)
        signal.removeEventListener('abort', onAbort)
        if (error) reject(error)
        else resolve(completion!)
      }
      // main 쪽 단계가 실패하면 워커는 결정·ack를 기다린 채 멈추므로 프로세스를 내린다.
      const fail = (error: Error): void => {
        this.stop(child)
        finish(error)
      }
      const onAbort = (): void => fail(new Error('mail_import_cancelled'))
      const onExit = (): void => {
        if (this.child === child) this.child = null
        finish(new Error('mail_source_worker_exited'))
      }
      const onMessage = (raw: unknown): void => {
        if (!isRecord(raw) || settled) return
        if (raw.jobId !== input.jobId || raw.epoch !== input.epoch) {
          fail(new Error('mail_import_epoch_revoked'))
        } else if (raw.type === 'ready') {
          channel.ready(String(raw.fingerprint)).then(
            (decision) => child.postMessage({ type: 'decision', ...decision }),
            (error: unknown) => fail(asError(error, 'mail_revision_start_failed'))
          )
        } else if (raw.type === 'batch') {
          channel
            .batch(
              raw.revision as number,
              raw.mails as Parameters<MailArchiveSourceChannel['batch']>[1]
            )
            .then(
              () => child.postMessage({ type: 'ack', batchId: raw.batchId }),
              (error: unknown) => fail(asError(error, 'mail_archive_batch_failed'))
            )
        } else if (raw.type === 'complete') {
          finish(null, {
            revision: typeof raw.revision === 'number' ? raw.revision : null,
            messages: typeof raw.messages === 'number' ? raw.messages : 0,
            skipped: raw.skipped === true,
            warnings: Array.isArray(raw.warnings) ? raw.warnings.map(String) : []
          })
        } else if (raw.type === 'error') {
          finish(
            new Error(typeof raw.reason === 'string' ? raw.reason : 'mail_source_parse_failed')
          )
        }
      }
      child.on('message', onMessage)
      child.on('exit', onExit)
      signal.addEventListener('abort', onAbort, { once: true })
      child.postMessage({ type: 'start', ...input })
    })
  }

  extract(input: MailArchiveAttachmentExportInput): Promise<MailArchiveAttachmentExportOutput> {
    const child = fork(sourceWorkerPath, 'Orca Mail Archive Attachment Export')
    const requestId = randomUUID()
    return new Promise((resolve, reject) => {
      child.on('message', (raw: unknown) => {
        if (!isRecord(raw) || raw.requestId !== requestId) return
        if (
          raw.type === 'extracted' &&
          typeof raw.temporaryPath === 'string' &&
          typeof raw.bytesWritten === 'number' &&
          Number.isSafeInteger(raw.bytesWritten) &&
          raw.bytesWritten >= 0
        ) {
          resolve({ temporaryPath: raw.temporaryPath, bytesWritten: raw.bytesWritten })
          return
        }
        child.kill()
        reject(
          new Error(typeof raw.reason === 'string' ? raw.reason : 'mail_attachment_export_failed')
        )
      })
      child.on('exit', () => reject(new Error('mail_attachment_worker_exited')))
      child.postMessage({ type: 'extract', requestId, input })
    })
  }

  dispose(): void {
    if (this.child) this.stop(this.child)
  }

  private stop(child: UtilityProcess): void {
    if (this.child === child) this.child = null
    child.kill()
  }
}

export function createMailArchiveWorkers(rootDir: string): {
  readonly index: MailArchiveIndex
  readonly source: MailArchiveSourceWorker
} {
  return { index: createIndexClient(rootDir), source: new SourceWorkerClient() }
}
