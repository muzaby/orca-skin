import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ArtifactCatalogItem } from '../../../../../shared/artifacts'
import {
  filterArtifactCatalog,
  refreshArtifactCatalog,
  setCatalogArtifactPinned,
  trashCatalogArtifact,
  useArtifactCatalogStore
} from './artifactCatalogStore'

const first: ArtifactCatalogItem = {
  sessionId: 'session',
  sessionTitle: 'Research notes',
  publicationId: 'publication',
  artifactFileId: 'file',
  title: 'Review report',
  filename: 'review.md',
  kind: 'markdown',
  sizeBytes: 12,
  publishedAt: 100,
  pinned: false
}
const second: ArtifactCatalogItem = {
  ...first,
  publicationId: 'second',
  artifactFileId: 'second-file',
  title: 'Dashboard',
  filename: 'dashboard.html',
  kind: 'html',
  pinned: true
}
const catalog = vi.fn()
const setPinned = vi.fn()
const trash = vi.fn()
function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolve!: (value: T) => void
  return {
    promise: new Promise<T>((done) => {
      resolve = done
    }),
    resolve
  }
}
beforeEach(async () => {
  catalog.mockReset().mockResolvedValue([first, second])
  setPinned.mockReset().mockResolvedValue({ ok: true })
  trash.mockReset().mockResolvedValue({ outcome: 'trashed', deletionRecorded: true })
  vi.stubGlobal('window', { orca: { artifacts: { catalog, setPinned, trash } } })
  useArtifactCatalogStore.setState({ items: [], loading: false, error: null, busy: {} })
  await refreshArtifactCatalog()
})
afterEach(() => vi.unstubAllGlobals())

describe('artifact catalog', () => {
  it('filters pinned items and searches title, filename and source conversation without case sensitivity', () => {
    expect(filterArtifactCatalog([first, second], 'pinned', '')).toEqual([second])
    expect(filterArtifactCatalog([first, second], 'all', '  REVIEW.MD  ')).toEqual([first])
    expect(filterArtifactCatalog([first, second], 'all', 'research DASHBOARD')).toEqual([second])
    expect(filterArtifactCatalog([first, second], 'pinned', 'review')).toEqual([])
  })
  it('applies persisted pin state only after success and prevents duplicate file actions', async () => {
    const pending = deferred<{ ok: boolean }>()
    setPinned.mockReturnValueOnce(pending.promise)
    const action = setCatalogArtifactPinned(first, true)
    expect(useArtifactCatalogStore.getState().busy.file).toBe(true)
    expect(useArtifactCatalogStore.getState().items[0].pinned).toBe(false)
    await setCatalogArtifactPinned(first, true)
    expect(setPinned).toHaveBeenCalledTimes(1)
    expect(setPinned).toHaveBeenCalledWith({
      sessionId: 'session',
      publicationId: 'publication',
      pinned: true
    })
    pending.resolve({ ok: true })
    await action
    expect(useArtifactCatalogStore.getState().items[0].pinned).toBe(true)
    expect(useArtifactCatalogStore.getState().busy.file).toBeUndefined()
  })
  it('keeps the item and pin state when a mutation fails', async () => {
    setPinned.mockResolvedValueOnce({ ok: false, reason: 'io-error' })
    await setCatalogArtifactPinned(first, true)
    expect(useArtifactCatalogStore.getState()).toMatchObject({
      items: [first, second],
      error: 'pin'
    })
    trash.mockRejectedValueOnce(new Error('private path'))
    expect(await trashCatalogArtifact(first)).toBe(false)
    expect(useArtifactCatalogStore.getState()).toMatchObject({
      items: [first, second],
      error: 'trash',
      busy: {}
    })
  })
  it.each(['trashed', 'already-missing'])(
    'removes a file after %s without clearing other items',
    async (outcome) => {
      trash.mockResolvedValueOnce({ outcome })
      expect(await trashCatalogArtifact(first)).toBe(true)
      expect(trash).toHaveBeenCalledWith({
        sessionId: first.sessionId,
        publicationId: first.publicationId
      })
      expect(useArtifactCatalogStore.getState().items).toEqual([second])
    }
  )
  it('does not let a refresh started before deletion resurrect the removed item', async () => {
    const pending = deferred<ArtifactCatalogItem[]>()
    catalog.mockReturnValueOnce(pending.promise)
    const refresh = refreshArtifactCatalog()
    await trashCatalogArtifact(first)
    pending.resolve([first, second])
    await refresh
    expect(useArtifactCatalogStore.getState()).toMatchObject({ items: [second], loading: false })
  })
  it('ignores an older refresh result and retains cached rows on refresh failure', async () => {
    const pending = deferred<ArtifactCatalogItem[]>()
    catalog.mockReturnValueOnce(pending.promise)
    const older = refreshArtifactCatalog()
    catalog.mockResolvedValueOnce([second])
    await refreshArtifactCatalog()
    pending.resolve([first])
    await older
    expect(useArtifactCatalogStore.getState().items).toEqual([second])
    catalog.mockRejectedValueOnce(new Error('offline'))
    await refreshArtifactCatalog()
    expect(useArtifactCatalogStore.getState()).toMatchObject({
      items: [second],
      loading: false,
      error: 'load'
    })
  })
})
