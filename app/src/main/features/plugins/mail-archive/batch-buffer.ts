export const MAIL_ARCHIVE_BATCH_SIZE = 25

export interface MailArchiveBatchBuffer<T> {
  push(item: T): Promise<void>
  flush(): Promise<void>
}

export function createAcknowledgedMailBatchSender<T>(
  send: (batchId: number, batch: readonly T[]) => void,
  waitForAck: (batchId: number) => Promise<unknown>
): (batch: readonly T[]) => Promise<void> {
  let nextBatchId = 0
  return async (batch) => {
    const batchId = ++nextBatchId
    const acknowledgement = waitForAck(batchId)
    send(batchId, batch)
    await acknowledgement
  }
}

/** A full batch blocks the reader until its owner confirms the write. */
export function createMailArchiveBatchBuffer<T>(
  sendBatch: (batch: readonly T[]) => Promise<void>,
  batchSize = MAIL_ARCHIVE_BATCH_SIZE
): MailArchiveBatchBuffer<T> {
  if (!Number.isInteger(batchSize) || batchSize < 1) {
    throw new Error('mail_archive_batch_size_invalid')
  }

  let current: T[] = []
  const flush = async (): Promise<void> => {
    if (current.length === 0) return
    const batch = current
    current = []
    await sendBatch(batch)
  }

  return {
    push: async (item) => {
      current.push(item)
      if (current.length >= batchSize) await flush()
    },
    flush
  }
}
