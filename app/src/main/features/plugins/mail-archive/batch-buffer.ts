export const MAIL_ARCHIVE_BATCH_SIZE = 25

/**
 * 가득 찬 batch는 owner가 쓰기를 확인(ack)할 때까지 reader를 멈춘다 — main·index 사이 큐가
 * batch 하나를 넘지 않는다.
 */
export function createMailArchiveBatchBuffer<T>(
  sendBatch: (batch: readonly T[]) => Promise<void>,
  batchSize = MAIL_ARCHIVE_BATCH_SIZE
): { push(item: T): Promise<void>; flush(): Promise<void> } {
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
