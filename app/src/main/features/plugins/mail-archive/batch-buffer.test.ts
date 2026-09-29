import { describe, expect, it } from 'vitest'
import { createAcknowledgedMailBatchSender, createMailArchiveBatchBuffer } from './batch-buffer'

describe('mail archive source batching', () => {
  it('does not read past a full batch until the index acknowledges it', async () => {
    let acknowledgeFirstBatch!: () => void
    const firstAcknowledgement = new Promise<void>((resolve) => {
      acknowledgeFirstBatch = resolve
    })
    let pulled = 0
    const batches: number[][] = []
    const sendBatch = createAcknowledgedMailBatchSender<number>(
      (batchId, batch) => {
        expect(batchId).toBe(batches.length + 1)
        batches.push([...batch])
      },
      async (batchId) => {
        if (batchId === 1) await firstAcknowledgement
      }
    )
    const buffer = createMailArchiveBatchBuffer(sendBatch)
    const scan = async (): Promise<void> => {
      for (let index = 0; index < 51; index += 1) {
        pulled += 1
        await buffer.push(index)
      }
      await buffer.flush()
    }

    const scanning = scan()
    await new Promise<void>((resolve) => setImmediate(resolve))
    expect(pulled).toBe(25)
    expect(batches.map((batch) => batch.length)).toEqual([25])

    acknowledgeFirstBatch()
    await scanning
    expect(pulled).toBe(51)
    expect(batches.map((batch) => batch.length)).toEqual([25, 25, 1])
  })
})
