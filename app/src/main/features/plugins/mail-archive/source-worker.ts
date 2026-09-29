import { archiveErrorCode } from './errors'
import { extractMailArchiveAttachment } from './readers/attachment-extract'
import { runSourceJob } from './source-job'
import type { MailArchiveAttachmentExportInput } from './types'
import type { MailArchiveSourceDecision, MailArchiveSourceInput } from './worker-contract'

const parentPort = process.parentPort
if (!parentPort) throw new Error('mail_archive_worker_parent_missing')

type WorkerCommand =
  | ({ readonly type: 'start' } & MailArchiveSourceInput)
  | { readonly type: 'decision'; readonly action: 'scan' | 'skip'; readonly revision?: number }
  | { readonly type: 'ack'; readonly batchId: number }
  | {
      readonly type: 'extract'
      readonly requestId: string
      readonly input: MailArchiveAttachmentExportInput
    }

/** 한 번에 한 파일만 처리한다. main이 결정·ack를 보낼 때까지 기다리는 자리. */
const waiters = new Map<string, (command: WorkerCommand) => void>()
let busy = false

function waitFor(key: string): Promise<WorkerCommand> {
  return new Promise((resolve) => waiters.set(key, resolve))
}

function settle(key: string, command: WorkerCommand): void {
  const resolve = waiters.get(key)
  waiters.delete(key)
  resolve?.(command)
}

async function processSource(input: MailArchiveSourceInput): Promise<void> {
  const token = { jobId: input.jobId, epoch: input.epoch }
  let batchId = 0
  busy = true
  try {
    const completion = await runSourceJob(
      input,
      {
        ready: async (fingerprint): Promise<MailArchiveSourceDecision> => {
          parentPort.postMessage({ type: 'ready', ...token, fingerprint })
          const command = await waitFor('decision')
          return command.type === 'decision' && command.action === 'scan' && command.revision
            ? { action: 'scan', revision: command.revision }
            : { action: 'skip' }
        },
        batch: async (revision, mails) => {
          const id = ++batchId
          parentPort.postMessage({ type: 'batch', ...token, batchId: id, revision, mails })
          await waitFor(`ack:${id}`)
        }
      },
      // 취소는 main이 이 프로세스를 종료하는 것으로 처리한다.
      new AbortController().signal
    )
    parentPort.postMessage({ type: 'complete', ...token, ...completion })
  } catch (error) {
    parentPort.postMessage({
      type: 'error',
      ...token,
      reason: archiveErrorCode(error, 'mail_source_parse_failed')
    })
  } finally {
    busy = false
  }
}

async function processExtraction(
  command: Extract<WorkerCommand, { type: 'extract' }>
): Promise<void> {
  try {
    const result = await extractMailArchiveAttachment(command.input, new AbortController().signal)
    parentPort.postMessage({ type: 'extracted', requestId: command.requestId, ...result })
  } catch (error) {
    parentPort.postMessage({
      type: 'extractError',
      requestId: command.requestId,
      reason: archiveErrorCode(error, 'mail_attachment_export_failed')
    })
  } finally {
    setImmediate(() => process.exit(0))
  }
}

parentPort.on('message', (event) => {
  const command = event.data as WorkerCommand
  if (command.type === 'start') {
    if (!busy) void processSource(command)
  } else if (command.type === 'extract') {
    if (!busy) void processExtraction(command)
  } else if (command.type === 'decision') {
    settle('decision', command)
  } else if (command.type === 'ack') {
    settle(`ack:${command.batchId}`, command)
  }
})
