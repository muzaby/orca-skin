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
  vi.stubGlobal('window', { orca: { artifacts: { preview } } })
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
  it('shows the selected title while loading then the same publication content', async () => {
    const pending = deferred()
    preview.mockReturnValueOnce(pending.promise)
    const request = openArtifactViewer('key', 's', ref)
    expect(useArtifactViewerStore.getState().selection).toMatchObject({
      sessionKey: 'key',
      artifact: ref,
      loading: true
    })
    pending.resolve(ready)
    await request
    expect(useArtifactViewerStore.getState().selection).toMatchObject({
      loading: false,
      result: ready
    })
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
  it('retry clears old errors and stale content, then reports the newest failure', async () => {
    preview.mockResolvedValueOnce({ state: 'unavailable', reason: 'missing' })
    await openArtifactViewer('key', 's', ref)
    expect(useArtifactViewerStore.getState().selection?.result).toEqual({
      state: 'unavailable',
      reason: 'missing'
    })
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
    expect(useArtifactViewerStore.getState().selection?.result).toEqual({
      state: 'unavailable',
      reason: 'io-error'
    })
  })
})
