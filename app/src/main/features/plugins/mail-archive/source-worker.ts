import { fingerprint } from './fingerprint'
import { createAcknowledgedMailBatchSender, createMailArchiveBatchBuffer } from './batch-buffer'
import { extractMailArchiveAttachment } from './readers/attachment-extract'
import { readEmlFile } from './readers/eml'
import { readPstFile } from './readers/pst'
import type { MailArchiveAttachmentExportInput, NormalizedArchiveMail } from './types'
import type { MailArchiveSourceInput, MailArchiveSourceDecision } from './worker-contract'

const parentPort = process.parentPort
if (!parentPort) throw new Error('mail_archive_worker_parent_missing')

type WorkerCommand =
  | ({ readonly type: 'start' } & MailArchiveSourceInput)
  | { readonly type: 'decision'; readonly action: 'scan'; readonly revision: number }
  | { readonly type: 'decision'; readonly action: 'skip' }
  | { readonly type: 'ack'; readonly batchId: number }
  | { readonly type: 'completeAck'; readonly ok: boolean }
  | {
      readonly type: 'extract'
      readonly requestId: string
      readonly input: MailArchiveAttachmentExportInput
    }
  | { readonly type: 'cancel' }

interface Waiter {
  resolve(value: WorkerCommand): void
  reject(error: Error): void
}

const waiters = new Map<string, Waiter>()
let activeController: AbortController | undefined

function settle(key: string, command: WorkerCommand): void {
  const waiter = waiters.get(key)
  if (!waiter) return
  waiters.delete(key)
  waiter.resolve(command)
}

function rejectWaiters(error: Error): void {
  for (const [key, waiter] of waiters) {
    waiters.delete(key)
    waiter.reject(error)
  }
}

function waitFor(key: string, signal: AbortSignal): Promise<WorkerCommand> {
  signal.throwIfAborted()
  return new Promise((resolve, reject) => {
    const abort = (): void => {
      waiters.delete(key)
      reject(new Error('mail_import_cancelled'))
    }
    signal.addEventListener('abort', abort, { once: true })
    waiters.set(key, {
      resolve: (value) => {
        signal.removeEventListener('abort', abort)
        resolve(value)
      },
      reject: (error) => {
        signal.removeEventListener('abort', abort)
        reject(error)
      }
    })
  })
}

function safeError(error: unknown): string {
  if (error instanceof Error && /^mail_[a-z0-9_:-]{1,160}$/i.test(error.message)) {
    return error.message
  }
  if (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof error.code === 'string' &&
    /^[A-Z0-9_]{2,32}$/.test(error.code)
  ) {
    return `mail_source_${error.code.toLowerCase()}`
  }
  return 'mail_source_parse_failed'
}

async function processExtraction(
  command: Extract<WorkerCommand, { type: 'extract' }>
): Promise<void> {
  const controller = new AbortController()
  activeController = controller
  try {
    const result = await extractMailArchiveAttachment(command.input, controller.signal)
    parentPort.postMessage({ type: 'extracted', requestId: command.requestId, ...result })
  } catch (error) {
    if (!controller.signal.aborted) {
      parentPort.postMessage({
        type: 'extractError',
        requestId: command.requestId,
        reason: safeError(error)
      })
    }
  } finally {
    activeController = undefined
    setImmediate(() => process.exit(0))
  }
}

async function sendAndWait(
  message: Record<string, unknown>,
  waiterKey: string,
  signal: AbortSignal
): Promise<WorkerCommand> {
  const response = waitFor(waiterKey, signal)
  parentPort.postMessage(message)
  return response
}

async function processSource(input: MailArchiveSourceInput): Promise<void> {
  const controller = new AbortController()
  activeController = controller
  const { signal } = controller
  const token = { jobId: input.jobId, epoch: input.epoch }
  try {
    const startFingerprint = await fingerprint(input.sourcePath, signal)
    const decisionCommand = await sendAndWait(
      { type: 'ready', ...token, fingerprint: startFingerprint },
      'decision',
      signal
    )
    const decision = decisionCommand as MailArchiveSourceDecision
    let revision: number | null = null
    let messages = 0
    let ignoredItems = 0
    const skipped = decision.action === 'skip'

    if (decision.action === 'scan') {
      revision = decision.revision
      const sendBatch = createAcknowledgedMailBatchSender<NormalizedArchiveMail>(
        (batchId, mails) =>
          parentPort.postMessage({ type: 'batch', ...token, batchId, revision, mails }),
        (batchId) => waitFor(`ack:${batchId}`, signal)
      )
      const batcher = createMailArchiveBatchBuffer(sendBatch)
      const onMessage = async (mail: NormalizedArchiveMail): Promise<void> => {
        signal.throwIfAborted()
        messages += 1
        await batcher.push(mail)
      }

      if (input.sourceKind === 'eml') {
        const mail = await readEmlFile(input.sourcePath, input.sourceId, startFingerprint, signal)
        await onMessage(mail)
      } else {
        await readPstFile({
          sourcePath: input.sourcePath,
          sourceId: input.sourceId,
          sourceFingerprint: startFingerprint,
          signal,
          onSkipped: () => {
            ignoredItems += 1
          },
          onMessage
        })
      }
      await batcher.flush()
    }

    const endFingerprint = skipped ? startFingerprint : await fingerprint(input.sourcePath, signal)
    const completeAck = await sendAndWait(
      {
        type: 'complete',
        ...token,
        startFingerprint,
        endFingerprint,
        revision,
        messages,
        ignoredItems,
        skipped
      },
      'complete',
      signal
    )
    if (completeAck.type !== 'completeAck' || !completeAck.ok) {
      throw new Error('mail_source_completion_rejected')
    }
  } catch (error) {
    if (!signal.aborted) {
      parentPort.postMessage({ type: 'error', ...token, reason: safeError(error) })
    }
  } finally {
    activeController = undefined
    parentPort.postMessage({ type: 'idle', ...token })
  }
}

parentPort.on('message', (event) => {
  const command = event.data as WorkerCommand
  if (command.type === 'cancel') {
    activeController?.abort()
    rejectWaiters(new Error('mail_import_cancelled'))
    return
  }
  if (command.type === 'start') {
    if (activeController) return
    void processSource(command)
    return
  }
  if (command.type === 'extract') {
    if (activeController) return
    void processExtraction(command)
    return
  }
  if (command.type === 'decision') settle('decision', command)
  else if (command.type === 'ack') settle(`ack:${command.batchId}`, command)
  else if (command.type === 'completeAck') settle('complete', command)
})
