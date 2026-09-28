import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ArtifactPreviewResult, ArtifactRef } from '../../../../../shared/artifacts'
import {
  closeArtifactViewer,
  openArtifactViewer,
  retryArtifactViewer,
  setArtifactViewerWidth,
  toggleArtifactViewerExpanded,
  useArtifactViewerStore
} from './artifactViewerStore'
import { errorToastStore } from '../../../shared/errors/errorToastStore'

const ref: ArtifactRef = {
  publicationId: 'p',
  artifactFileId: 'f',
  title: 'Report',
  filename: 'report.md',
  kind: 'markdown',
  sizeBytes: 9,
  publishedAt: 1
}
const ready: ArtifactPreviewResult = {
  state: 'ready',
  format: 'markdown',
  content: '# Report',
  mimeType: 'text/markdown'
}
const preview = vi.fn()
const logError = vi.fn()
function deferred(): {
  promise: Promise<ArtifactPreviewResult>
  resolve: (value: ArtifactPreviewResult) => void
} {
  let resolve!: (value: ArtifactPreviewResult) => void
  const promise = new Promise<ArtifactPreviewResult>((done) => {
    resolve = done
  })
  return { promise, resolve }
}
beforeEach(() => {
  closeArtifactViewer()
  preview.mockReset().mockResolvedValue(ready)
  logError.mockReset()
  for (const toast of errorToastStore.getState().toasts)
    errorToastStore.getState().dismiss(toast.id)
  vi.stubGlobal('window', { orca: { artifacts: { preview }, log: { error: logError } } })
})
afterEach(() => vi.unstubAllGlobals())
describe('viewer selection and request lifetime', () => {
  it('preserves independent host widths across expand, close and publication changes without reloading', async () => {
    await openArtifactViewer('key', 's', ref)
    const selection = useArtifactViewerStore.getState().selection
    setArtifactViewerWidth('transcript', 710)
    setArtifactViewerWidth('catalog', 620)
    expect(useArtifactViewerStore.getState().selection).toBe(selection)
    toggleArtifactViewerExpanded()
    toggleArtifactViewerExpanded()
    closeArtifactViewer()
    await openArtifactViewer('key', 's', { ...ref, publicationId: 'p2' })
    expect(useArtifactViewerStore.getState().widths).toEqual({ transcript: 710, catalog: 620 })
    expect(preview).toHaveBeenCalledTimes(2)
  })
  it('allocates the viewer only once the preview result arrives (0242 ΔV4 AC27)', async () => {
    const pending = deferred()
    preview.mockReturnValueOnce(pending.promise)
    const request = openArtifactViewer('key', 's', ref)
    expect(useArtifactViewerStore.getState().selection).toBeNull()
    expect(useArtifactViewerStore.getState().opening).toMatchObject({
      sessionKey: 'key',
      publicationId: 'p'
    })
    const seen: unknown[] = []
    const stop = useArtifactViewerStore.subscribe((state, prev) => {
      if (state.selection !== prev.selection) seen.push(state.selection)
    })
    pending.resolve(ready)
    await request
    stop()
    expect(seen).toHaveLength(1)
    expect(useArtifactViewerStore.getState().selection).toMatchObject({
      sessionKey: 'key',
      artifact: ref,
      loading: false,
      result: ready
    })
    expect(useArtifactViewerStore.getState().opening).toBeNull()
  })
  it('never allocates viewer space for an inaccessible file and keeps an open viewer (0242 ΔV4 AC26)', async () => {
    await openArtifactViewer('key', 's', { ...ref, publicationId: 'open' })
    const open = useArtifactViewerStore.getState().selection
    const seen: unknown[] = []
    const stop = useArtifactViewerStore.subscribe((state, prev) => {
      if (state.selection !== prev.selection) seen.push(state.selection)
    })
    preview.mockResolvedValueOnce({ state: 'unavailable', reason: 'missing' })
    await openArtifactViewer('key', 's', ref)
    closeArtifactViewer('other-key')
    stop()
    expect(seen).toEqual([])
    expect(useArtifactViewerStore.getState().selection).toBe(open)
    expect(errorToastStore.getState().toasts.map(({ title }) => title)).toEqual(['fileUnavailable'])
  })
  it('cancels a pending open when its session closes and ignores a duplicate click (0242 ΔV4 AC28·AC29)', async () => {
    const pending = deferred()
    preview.mockReturnValueOnce(pending.promise)
    const first = openArtifactViewer('key', 's', ref)
    await openArtifactViewer('key', 's', ref)
    expect(preview).toHaveBeenCalledTimes(1)
    closeArtifactViewer('key')
    expect(useArtifactViewerStore.getState().opening).toBeNull()
    pending.resolve({ state: 'unavailable', reason: 'missing' })
    await first
    expect(useArtifactViewerStore.getState().selection).toBeNull()
    expect(errorToastStore.getState().toasts).toEqual([])
  })
  it('discards an older file response after quickly selecting another file', async () => {
    const old = deferred()
    preview.mockReturnValueOnce(old.promise)
    const request = openArtifactViewer('key', 's', ref)
    await openArtifactViewer('key', 's', { ...ref, publicationId: 'p2', title: 'Second' })
    old.resolve({ ...ready, content: 'STALE' })
    await request
    expect(useArtifactViewerStore.getState().selection?.artifact.title).toBe('Second')
    expect(useArtifactViewerStore.getState().selection?.result).toEqual(ready)
  })
  it('close and unmount invalidate the pending response, including reopening the same file', async () => {
    const old = deferred()
    preview.mockReturnValueOnce(old.promise)
    const request = openArtifactViewer('key', 's', ref)
    closeArtifactViewer('key')
    expect(useArtifactViewerStore.getState().selection).toBeNull()
    await openArtifactViewer('key', 's', ref)
    old.resolve({ ...ready, content: 'STALE' })
    await request
    expect(useArtifactViewerStore.getState().selection?.result).toEqual(ready)
  })
  it('a previous session cleanup cannot close the new session viewer', async () => {
    await openArtifactViewer('key-a', 'a', ref)
    await openArtifactViewer('key-b', 'b', { ...ref, title: 'Session B' })
    closeArtifactViewer('key-a')
    expect(useArtifactViewerStore.getState().selection?.sessionId).toBe('b')
  })
  it('reports an inaccessible file as a toast; a retry in an open viewer closes it (0242 ΔV2 AC20 · ΔV4)', async () => {
    const toasts = (): unknown[] =>
      errorToastStore.getState().toasts.map(({ title, detail }) => ({ title, detail }))
    preview.mockResolvedValueOnce({ state: 'unavailable', reason: 'missing' })
    await openArtifactViewer('key', 's', ref)
    expect(useArtifactViewerStore.getState().selection).toBeNull()
    expect(toasts()).toEqual([
      { title: 'fileUnavailable', detail: 'report.md: 파일 없음 — 삭제되었거나 이동되었습니다' }
    ])
    expect(logError.mock.calls.map(([event]) => event)).toEqual(['artifacts.preview.failed'])

    await openArtifactViewer('key', 's', ref)
    const pending = deferred()
    preview.mockReturnValueOnce(pending.promise)
    const retry = retryArtifactViewer()
    expect(useArtifactViewerStore.getState().selection).toMatchObject({
      loading: true,
      result: undefined
    })
    pending.resolve(ready)
    await retry
    expect(useArtifactViewerStore.getState().selection?.result).toEqual(ready)

    preview.mockRejectedValueOnce(new Error('private path'))
    await retryArtifactViewer()
    expect(useArtifactViewerStore.getState().selection).toBeNull()
    expect(toasts()).toHaveLength(2)
    expect(JSON.stringify(toasts())).not.toContain('private path')
  })
  it('keeps unsupported formats in the viewer body without a toast', async () => {
    preview.mockResolvedValueOnce({ state: 'unavailable', reason: 'unsupported-format' })
    await openArtifactViewer('key', 's', ref)
    expect(useArtifactViewerStore.getState().selection?.result).toEqual({
      state: 'unavailable',
      reason: 'unsupported-format'
    })
    expect(errorToastStore.getState().toasts).toEqual([])
  })
  it('drops a late unavailable result for a replaced selection without a toast', async () => {
    const pending = deferred()
    preview.mockReturnValueOnce(pending.promise)
    const first = openArtifactViewer('key', 's', ref)
    await openArtifactViewer('key', 's', { ...ref, publicationId: 'p2' })
    pending.resolve({ state: 'unavailable', reason: 'missing' })
    await first
    expect(useArtifactViewerStore.getState().selection?.artifact.publicationId).toBe('p2')
    expect(errorToastStore.getState().toasts).toEqual([])
  })
})
