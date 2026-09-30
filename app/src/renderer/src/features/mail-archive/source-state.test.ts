import { describe, expect, it, vi, type Mock, type Mocked } from 'vitest'
import { createMailArchiveSourceStore, type MailArchiveSourceApi } from './source-state'
import type { MailArchiveProgress, MailArchiveStats } from '../../../../shared/mail-archive'

const stats: MailArchiveStats = {
  totalMessages: 1,
  emlMessages: 1,
  pstMessages: 0,
  lastImportedAt: null
}
const source = {
  id: 'first',
  kind: 'eml' as const,
  name: 'first.eml',
  messageCount: 1,
  sharedMessageCount: 0,
  lastImportedAt: null
}
const running: MailArchiveProgress = {
  jobId: 'job',
  state: 'running',
  currentPath: null,
  processedFiles: 1,
  totalFiles: 2,
  processedMessages: 1,
  insertedMessages: 1,
  skippedMessages: 0,
  failedFiles: 0,
  cancellable: true
}
function deferred<T>(): {
  promise: Promise<T>
  resolve(value: T): void
  reject(error: Error): void
} {
  let resolve!: (value: T) => void
  let reject!: (error: Error) => void
  const promise = new Promise<T>((yes, no) => {
    resolve = yes
    reject = no
  })
  return { promise, resolve, reject }
}
function fixture(): {
  api: Mocked<MailArchiveSourceApi>
  store: ReturnType<typeof createMailArchiveSourceStore>
  unsubscribe: Mock<() => void>
  emit(progress: MailArchiveProgress): void
} {
  let emit!: (progress: MailArchiveProgress) => void
  const unsubscribe = vi.fn()
  const api = {
    stats: vi.fn(async () => stats),
    sources: vi.fn(async () => [source]),
    onProgress: vi.fn((handler: typeof emit) => {
      emit = handler
      return unsubscribe
    }),
    pickFiles: vi.fn(async () => ({ selectionId: 'selected' })),
    pickEmlFolder: vi.fn(async () => ({ selectionId: 'folder' })),
    import: vi.fn<MailArchiveSourceApi['import']>(async () => ({
      jobId: 'job',
      state: 'completed' as const,
      files: 1,
      messages: 1,
      inserted: 1,
      skipped: 0,
      failures: []
    })),
    cancel: vi.fn(async () => ({ cancelled: true })),
    removeSource: vi.fn<MailArchiveSourceApi['removeSource']>(async () => ({
      state: 'removed',
      sourceName: 'first.eml',
      removedMessages: 1,
      preservedMessages: 0,
      importCancelled: false
    }))
  } satisfies MailArchiveSourceApi
  const store = createMailArchiveSourceStore(api)
  return { api, store, unsubscribe, emit: (progress: MailArchiveProgress) => emit(progress) }
}
describe('shared source state', () => {
  it('shares one progress subscription across settings/page and releases it after the last reader', async () => {
    const f = fixture()
    const settings = f.store.getState().acquire()
    const page = f.store.getState().acquire()
    await vi.waitFor(() => expect(f.store.getState().sources).toEqual([source]))
    expect(f.api.onProgress).toHaveBeenCalledTimes(1)
    settings()
    settings()
    expect(f.unsubscribe).not.toHaveBeenCalled()
    f.emit(running)
    expect(f.store.getState().progress).toEqual(running)
    page()
    expect(f.unsubscribe).toHaveBeenCalledTimes(1)
    f.emit({ ...running, processedFiles: 99 })
    expect(f.store.getState().progress).toEqual(running)
    const again = f.store.getState().acquire()
    await vi.waitFor(() => expect(f.api.stats).toHaveBeenCalledTimes(2))
    expect(f.api.onProgress).toHaveBeenCalledTimes(2)
    again()
  })
  it('discards a late source snapshot and its errors after a newer refresh', async () => {
    const f = fixture()
    const old = deferred<MailArchiveStats>()
    f.api.stats.mockReturnValueOnce(old.promise)
    const first = f.store.getState().refresh()
    f.api.sources.mockResolvedValueOnce([])
    f.api.stats.mockResolvedValueOnce({ ...stats, totalMessages: 0 })
    await f.store.getState().refresh(true)
    old.reject(new Error('mail_source_enoent'))
    await first
    expect(f.store.getState()).toMatchObject({
      sources: [],
      stats: { totalMessages: 0 },
      errorKey: null,
      revision: 1
    })
  })
  it('preserves a push event over an older progress snapshot and refreshes on completion', async () => {
    const f = fixture()
    const old = deferred<MailArchiveStats>()
    f.api.stats.mockReturnValueOnce(old.promise)
    const release = f.store.getState().acquire()
    f.emit(running)
    old.resolve({ ...stats, progress: null })
    await vi.waitFor(() => expect(f.store.getState().loading).toBe(false))
    expect(f.store.getState().progress).toEqual(running)
    f.api.stats.mockResolvedValueOnce({ ...stats, totalMessages: 2 })
    f.emit({ ...running, state: 'completed' })
    await vi.waitFor(() => expect(f.store.getState().revision).toBe(1))
    expect(f.store.getState().stats?.totalMessages).toBe(2)
    release()
  })
  it('adds using the selected capability, updates the common revision, and locks duplicate actions', async () => {
    const f = fixture()
    const pending = deferred<Awaited<ReturnType<MailArchiveSourceApi['import']>>>()
    f.api.import.mockReturnValueOnce(pending.promise)
    const importing = f.store.getState().add('eml-folder')
    await vi.waitFor(() => expect(f.api.import).toHaveBeenCalledWith({ selectionId: 'folder' }))
    await f.store.getState().add('files')
    expect(f.api.pickFiles).not.toHaveBeenCalled()
    pending.resolve({
      jobId: 'job',
      state: 'completed',
      files: 1,
      messages: 1,
      inserted: 1,
      skipped: 0,
      failures: []
    })
    await importing
    expect(f.store.getState()).toMatchObject({
      importing: false,
      sources: [source],
      revision: 1,
      lastImport: { inserted: 1 }
    })
  })
  it('reports picker/import/cancel/remove failures and preserves existing source data', async () => {
    const f = fixture()
    await f.store.getState().refresh()
    f.api.pickFiles.mockRejectedValueOnce(new Error('mail_source_not_selected'))
    await f.store.getState().add('files')
    expect(f.store.getState().errorKey).toBe('mailArchiveRepair.pickAgain')
    expect(f.store.getState().sources).toEqual([source])
    await f.store.getState().refresh()
    expect(f.store.getState().errorKey).toBeNull()
    f.api.import.mockRejectedValueOnce(new Error('mail_archive_index_timeout'))
    await f.store.getState().add('files')
    expect(f.store.getState().errorKey).toBe('mailArchiveRepair.workerRetry')
    f.store.setState({ progress: running })
    f.api.cancel.mockRejectedValueOnce(new Error('mail_source_timeout'))
    await f.store.getState().cancel()
    expect(f.api.cancel).toHaveBeenCalledWith('job')
    expect(f.store.getState().errorKey).toBe('mailArchiveRepair.workerRetry')
    f.api.removeSource.mockRejectedValueOnce(new Error('mail_source_enoent'))
    await f.store.getState().remove(source.id)
    expect(f.store.getState()).toMatchObject({
      errorKey: 'mailArchiveRepair.sourceMissing',
      sources: [source],
      removingSourceId: null
    })
  })
  it('treats cancelled removal as no mutation and successful removal refreshes both consumers', async () => {
    const f = fixture()
    await f.store.getState().refresh()
    f.api.removeSource.mockResolvedValueOnce({ state: 'cancelled' })
    await f.store.getState().remove(source.id)
    expect(f.store.getState().revision).toBe(0)
    f.api.sources.mockResolvedValueOnce([])
    await f.store.getState().remove(source.id)
    expect(f.store.getState()).toMatchObject({
      sources: [],
      revision: 1,
      lastRemoval: { state: 'removed' }
    })
  })
})
