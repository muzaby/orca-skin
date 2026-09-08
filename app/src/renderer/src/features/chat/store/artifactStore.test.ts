import { beforeEach, describe, expect, it, vi } from 'vitest'
const api = vi.hoisted(() => ({
  list: vi.fn(),
  status: vi.fn(),
  save: vi.fn(),
  reveal: vi.fn(),
  trash: vi.fn(),
  openFolder: vi.fn()
}))
vi.mock('../../../shared/api/ipc', () => ({ artifactApi: api }))
import {
  acquireArtifacts,
  forgetArtifacts,
  refreshArtifactStatuses,
  runArtifactAction,
  useArtifactStore,
  refreshArtifactList
} from './artifactStore'
import type { ArtifactRef, ArtifactStatusItem } from '../../../../../shared/artifacts'
const ref: ArtifactRef = {
  publicationId: 'p',
  artifactFileId: 'f',
  title: 'Report',
  filename: 'report.md',
  kind: 'markdown',
  sizeBytes: 10,
  publishedAt: 1
}
function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((r) => {
    resolve = r
  })
  return { promise, resolve }
}
const present = (publicationId = 'p'): ArtifactStatusItem => ({
  publicationId,
  artifactFileId: 'f',
  availability: { state: 'present', sizeBytes: 10, modifiedAt: 1 }
})
beforeEach(() => {
  useArtifactStore.setState({ sessions: {} })
  vi.resetAllMocks()
  api.status.mockResolvedValue([present()])
  api.list.mockResolvedValue([ref])
})
describe('artifact UI lifetime and file operations', () => {
  it('merges concurrent checks for the same file and does not turn a failed trash into missing', async () => {
    acquireArtifacts('s', [ref])
    const waiting = deferred<ArtifactStatusItem[]>()
    api.status.mockReturnValueOnce(waiting.promise)
    const first = refreshArtifactStatuses('s', [ref])
    await refreshArtifactStatuses('s', [ref])
    expect(api.status).toHaveBeenCalledTimes(1)
    waiting.resolve([present()])
    await first
    api.trash.mockResolvedValue({ outcome: 'failed', reason: 'trash-failed' })
    const result = await runArtifactAction('s', [ref], 'trash')
    expect(result).toEqual({ outcome: 'failed', reason: 'trash-failed' })
    expect(useArtifactStore.getState().sessions.s.files.f.availability?.state).toBe('present')
    expect(useArtifactStore.getState().sessions.s.files.f.busy).toBe(false)
  })
  it('discards a status response after deletion and same-ID recreation', async () => {
    const old = deferred<ArtifactStatusItem[]>()
    api.status.mockReturnValueOnce(old.promise)
    const release = acquireArtifacts('s', [ref])
    const request = refreshArtifactStatuses('s', [ref])
    forgetArtifacts('s')
    acquireArtifacts('s', [ref])
    old.resolve([present()])
    await request
    release()
    expect(useArtifactStore.getState().sessions.s.files.f.availability).toBeUndefined()
    expect(useArtifactStore.getState().sessions.s.users).toBe(1)
  })
  it('projects trash to both fork references and rejects old present responses', async () => {
    acquireArtifacts('s', [ref])
    acquireArtifacts('fork', [{ ...ref, publicationId: 'p2' }])
    const old = deferred<ArtifactStatusItem[]>()
    api.status.mockReturnValueOnce(old.promise)
    const request = refreshArtifactStatuses('fork', [{ ...ref, publicationId: 'p2' }])
    api.trash.mockResolvedValue({ outcome: 'trashed', deletionRecorded: false })
    api.status.mockResolvedValue([{ ...present(), availability: { state: 'missing' } }])
    await runArtifactAction('s', [ref], 'trash')
    old.resolve([present('p2')])
    await request
    expect(useArtifactStore.getState().sessions.s.files.f.availability?.state).toBe('missing')
    expect(useArtifactStore.getState().sessions.fork.files.f.availability?.state).toBe('missing')
    api.status.mockResolvedValue([present()])
    await refreshArtifactStatuses('s', [ref])
    expect(useArtifactStore.getState().sessions.fork.files.f.availability?.state).toBe('present')
  })
  it('keeps list completion from reviving a closed surface and suppresses duplicate trash', async () => {
    const release = acquireArtifacts('s', [ref], true)
    const list = deferred<ArtifactRef[]>()
    api.list.mockReturnValueOnce(list.promise)
    const request = refreshArtifactList('s')
    release()
    list.resolve([ref])
    await request
    expect(useArtifactStore.getState().sessions.s).toBeUndefined()
    acquireArtifacts('s', [ref])
    const trash = deferred<{ outcome: 'trashed'; deletionRecorded: boolean }>()
    api.trash.mockReturnValueOnce(trash.promise)
    const first = runArtifactAction('s', [ref], 'trash')
    await runArtifactAction('s', [ref], 'trash')
    expect(api.trash).toHaveBeenCalledTimes(1)
    trash.resolve({ outcome: 'trashed', deletionRecorded: true })
    await first
  })
  it('bounds and de-duplicates known status IDs; save freezes publication IDs', async () => {
    const refs = Array.from({ length: 101 }, (_, i) => ({
      ...ref,
      publicationId: `p${i}`,
      artifactFileId: `f${i}`
    }))
    acquireArtifacts('s', refs)
    api.status.mockResolvedValue([])
    await refreshArtifactStatuses('s', [...refs, refs[0]])
    expect(api.status.mock.calls.map(([r]) => r.publicationIds.length)).toEqual([100, 1])
    api.save.mockResolvedValue({ outcome: 'cancelled', items: [] })
    const selected = [refs[0], refs[1]]
    const save = runArtifactAction('s', selected, 'save')
    selected.splice(0)
    await save
    expect(api.save).toHaveBeenCalledWith({ sessionId: 's', publicationIds: ['p0', 'p1'] })
    api.save.mockClear()
    expect(await runArtifactAction('s', refs, 'save')).toEqual({
      outcome: 'failed',
      items: [],
      reason: 'too-many-items'
    })
    expect(api.save).not.toHaveBeenCalled()
  })
})
