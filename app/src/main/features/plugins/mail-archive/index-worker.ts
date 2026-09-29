import { createMailArchiveStore, type MailArchiveStore } from './store'

type IndexOperation =
  | 'init'
  | 'openEpoch'
  | 'revokeEpoch'
  | 'beginRevision'
  | 'upsertBatch'
  | 'verifyRevision'
  | 'activateRevision'
  | 'abortRevision'
  | 'search'
  | 'get'
  | 'thread'
  | 'attachmentLocation'
  | 'sourcePathInUse'
  | 'sources'
  | 'removeSource'
  | 'stats'
  | 'close'

interface IndexRequest {
  readonly requestId: number
  readonly operation: IndexOperation
  readonly payload?: unknown
}

const parentPort = process.parentPort
if (!parentPort) throw new Error('mail_archive_worker_parent_missing')

let store: MailArchiveStore | undefined
let queue = Promise.resolve()
const activeEpochs = new Set<string>()
const revokedEpochs = new Set<string>()

function assertEpoch(epoch: string): void {
  if (!epoch || revokedEpochs.has(epoch) || !activeEpochs.has(epoch)) {
    throw new Error('mail_import_epoch_revoked')
  }
}

async function handle(request: IndexRequest): Promise<void> {
  try {
    let value: unknown
    switch (request.operation) {
      case 'init': {
        if (store) throw new Error('mail_archive_store_already_initialized')
        const rootDir = request.payload as string
        store = createMailArchiveStore(rootDir)
        value = { ready: true }
        break
      }
      case 'openEpoch': {
        const epoch = request.payload as string
        if (revokedEpochs.has(epoch)) throw new Error('mail_import_epoch_revoked')
        revokedEpochs.clear()
        activeEpochs.add(epoch)
        value = null
        break
      }
      case 'revokeEpoch': {
        const epoch = request.payload as string
        activeEpochs.delete(epoch)
        revokedEpochs.add(epoch)
        value = null
        break
      }
      case 'beginRevision':
        value = requireStore().beginRevision(
          request.payload as Parameters<MailArchiveStore['beginRevision']>[0]
        )
        break
      case 'upsertBatch': {
        const payload = request.payload as Parameters<MailArchiveStore['upsertBatch']>[0] & {
          epoch: string
        }
        assertEpoch(payload.epoch)
        const batch = {
          sourceId: payload.sourceId,
          revision: payload.revision,
          mails: payload.mails
        }
        value = requireStore().upsertBatch(batch)
        break
      }
      case 'verifyRevision': {
        const payload = request.payload as {
          sourceId: string
          revision: number
          fingerprint: string
          epoch: string
        }
        assertEpoch(payload.epoch)
        requireStore().verifyRevision(payload.sourceId, payload.revision, payload.fingerprint)
        value = null
        break
      }
      case 'activateRevision': {
        const payload = request.payload as {
          sourceId: string
          revision: number
          fingerprint: string
          epoch: string
        }
        assertEpoch(payload.epoch)
        requireStore().activateRevision(payload.sourceId, payload.revision, payload.fingerprint)
        value = null
        break
      }
      case 'abortRevision': {
        const payload = request.payload as {
          sourceId: string
          revision: number
          state?: 'interrupted' | 'failed'
        }
        requireStore().abortRevision(payload.sourceId, payload.revision, payload.state)
        value = null
        break
      }
      case 'search':
        value = requireStore().search(request.payload as Parameters<MailArchiveStore['search']>[0])
        break
      case 'get':
        value = requireStore().get((request.payload as { id: string }).id)
        break
      case 'thread':
        value = requireStore().thread(request.payload as Parameters<MailArchiveStore['thread']>[0])
        break
      case 'attachmentLocation':
        value = requireStore().attachmentLocation((request.payload as { id: string }).id)
        break
      case 'sourcePathInUse':
        value = requireStore().sourcePathInUse((request.payload as { path: string }).path)
        break
      case 'sources':
        value = requireStore().sources()
        break
      case 'removeSource': {
        if (activeEpochs.size > 0) throw new Error('mail_archive_import_active')
        value = requireStore().removeSource((request.payload as { id: string }).id)
        break
      }
      case 'stats':
        value = requireStore().stats()
        break
      case 'close':
        store?.close()
        store = undefined
        value = null
        break
    }
    parentPort.postMessage({ requestId: request.requestId, ok: true, value })
    if (request.operation === 'close') setImmediate(() => process.exit(0))
  } catch (error) {
    parentPort.postMessage({
      requestId: request.requestId,
      ok: false,
      error: error instanceof Error ? error.message.slice(0, 160) : 'mail_archive_index_failed'
    })
  }
}

function requireStore(): MailArchiveStore {
  if (!store) throw new Error('mail_archive_store_not_ready')
  return store
}

parentPort.on('message', (event) => {
  const request = event.data as IndexRequest
  if (request.operation === 'revokeEpoch' && typeof request.payload === 'string') {
    activeEpochs.delete(request.payload)
    revokedEpochs.add(request.payload)
  }
  queue = queue.then(() => handle(request))
})
