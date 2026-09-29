import { createIndexOperations, type IndexOperationName } from './index-operations'
import { createMailArchiveStore } from './store'

const parentPort = process.parentPort
if (!parentPort) throw new Error('mail_archive_worker_parent_missing')
const rootDir = process.env.ORCA_MAIL_ARCHIVE_ROOT
if (!rootDir) throw new Error('mail_archive_root_missing')

const operations = createIndexOperations(() => createMailArchiveStore(rootDir))
let queue = Promise.resolve()

parentPort.on('message', (event) => {
  const { requestId, operation, payload } = event.data as {
    requestId: number
    operation: IndexOperationName
    payload?: unknown
  }
  // 폐기는 큐를 기다리지 않는다. 이미 줄 선 batch도 commit 직전에 거절된다.
  if (operation === 'revokeEpoch') operations.revokeEpoch(payload as string)
  queue = queue.then(() => {
    try {
      const value = (operations[operation] as (input?: unknown) => unknown)(payload)
      parentPort.postMessage({ requestId, ok: true, value })
    } catch (error) {
      const message = error instanceof Error ? error.message.slice(0, 160) : ''
      parentPort.postMessage({
        requestId,
        ok: false,
        error: message || 'mail_archive_index_failed'
      })
    }
    if (operation === 'close') setImmediate(() => process.exit(0))
  })
})
