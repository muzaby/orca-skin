import { create } from 'zustand'
import { artifactApi } from '../../../shared/api/ipc'
import type {
  ArtifactAvailability,
  ArtifactRef,
  ArtifactSaveResult,
  ArtifactActionResult,
  ArtifactTrashResult
} from '../../../../../shared/artifacts'

export interface ArtifactFileView {
  availability?: ArtifactAvailability
  lastTrashedAt?: number
  checking: boolean
  busy: boolean
  version: number
}
interface ArtifactSessionView {
  lifetime: number
  users: number
  listUsers: number
  listRequest: number
  list: ArtifactRef[]
  listLoading: boolean
  listError: boolean
  refs: Record<string, ArtifactRef>
  files: Record<string, ArtifactFileView>
}
interface ArtifactStoreState {
  sessions: Record<string, ArtifactSessionView>
}
export const useArtifactStore = create<ArtifactStoreState>()(() => ({ sessions: {} }))
let sequence = 0
const emptyFile = (): ArtifactFileView => ({ checking: false, busy: false, version: 0 })

// 현재 마운트된 chat 표면만 소유한다. 마지막 표면이 닫히거나 대화가 삭제되면 폐기한다.
export function acquireArtifacts(
  sessionId: string,
  refs: readonly ArtifactRef[],
  list = false
): () => void {
  let lifetime = 0
  useArtifactStore.setState((state) => {
    const current = state.sessions[sessionId] ?? {
      lifetime: ++sequence,
      users: 0,
      listUsers: 0,
      listRequest: 0,
      list: [],
      listLoading: false,
      listError: false,
      refs: {},
      files: {}
    }
    lifetime = current.lifetime
    const files = { ...current.files }
    const known = { ...current.refs }
    for (const ref of refs) {
      known[ref.publicationId] = ref
      files[ref.artifactFileId] ??=
        Object.values(state.sessions).find((entry) => entry.files[ref.artifactFileId])?.files[
          ref.artifactFileId
        ] ?? emptyFile()
    }
    return {
      sessions: {
        ...state.sessions,
        [sessionId]: {
          ...current,
          users: current.users + 1,
          listUsers: current.listUsers + Number(list),
          refs: known,
          files
        }
      }
    }
  })
  return () => {
    useArtifactStore.setState((state) => {
      const current = state.sessions[sessionId]
      if (!current || current.lifetime !== lifetime) return state
      const sessions = { ...state.sessions }
      if (current.users === 1) delete sessions[sessionId]
      else
        sessions[sessionId] = {
          ...current,
          users: current.users - 1,
          listUsers: current.listUsers - Number(list)
        }
      return { sessions }
    })
  }
}

export function forgetArtifacts(sessionId: string): void {
  useArtifactStore.setState((state) => {
    if (!state.sessions[sessionId]) return state
    const sessions = { ...state.sessions }
    delete sessions[sessionId]
    return { sessions }
  })
}

function updateFile(fileId: string, update: (file: ArtifactFileView) => ArtifactFileView): void {
  useArtifactStore.setState((state) => {
    let sessions = state.sessions
    for (const [id, entry] of Object.entries(state.sessions)) {
      const file = entry.files[fileId]
      if (!file) continue
      const next = update(file)
      if (next === file) continue
      if (sessions === state.sessions) sessions = { ...sessions }
      sessions[id] = { ...entry, files: { ...entry.files, [fileId]: next } }
    }
    return sessions === state.sessions ? state : { sessions }
  })
}

export async function refreshArtifactList(sessionId: string): Promise<void> {
  const entry = useArtifactStore.getState().sessions[sessionId]
  if (!entry?.listUsers) return
  const request = ++sequence
  const patch = (update: Partial<ArtifactSessionView>): void => {
    useArtifactStore.setState((state) => {
      const current = state.sessions[sessionId]
      if (
        !current ||
        current.lifetime !== entry.lifetime ||
        !current.listUsers ||
        (current.listRequest !== request && update.listRequest !== request)
      )
        return state
      return { sessions: { ...state.sessions, [sessionId]: { ...current, ...update } } }
    })
  }
  patch({ listRequest: request, listLoading: true, listError: false })
  try {
    patch({ list: await artifactApi.list({ sessionId }), listLoading: false })
  } catch {
    patch({ listLoading: false, listError: true })
  }
}

export async function refreshArtifactStatuses(
  sessionId: string,
  refs: readonly ArtifactRef[]
): Promise<void> {
  const entry = useArtifactStore.getState().sessions[sessionId]
  if (!entry) return
  const unique = [...new Map(refs.map((ref) => [ref.artifactFileId, ref])).values()].filter(
    (ref) =>
      entry.refs[ref.publicationId] &&
      !entry.files[ref.artifactFileId]?.busy &&
      !entry.files[ref.artifactFileId]?.checking
  )
  const versions = new Map<string, number>()
  const abandon = (): void => {
    for (const [fileId, version] of versions)
      updateFile(fileId, (file) =>
        file.version !== version
          ? file
          : {
              ...file,
              checking: false,
              availability: file.availability ?? { state: 'unavailable', reason: 'io-error' }
            }
      )
  }
  for (const ref of unique) {
    const version = ++sequence
    versions.set(ref.artifactFileId, version)
    updateFile(ref.artifactFileId, (file) => ({ ...file, version, checking: true }))
  }
  for (let offset = 0; offset < unique.length; offset += 100) {
    const batch = unique.slice(offset, offset + 100)
    try {
      const results = await artifactApi.status({
        sessionId,
        publicationIds: batch.map((ref) => ref.publicationId)
      })
      if (useArtifactStore.getState().sessions[sessionId]?.lifetime !== entry.lifetime) {
        abandon()
        return
      }
      for (const ref of batch) {
        const result = results.find(
          (item) =>
            item.publicationId === ref.publicationId && item.artifactFileId === ref.artifactFileId
        )
        updateFile(ref.artifactFileId, (file) =>
          file.version !== versions.get(ref.artifactFileId)
            ? file
            : {
                ...file,
                checking: false,
                availability: result?.availability ?? { state: 'unavailable', reason: 'io-error' },
                lastTrashedAt: result?.lastTrashedAt
              }
        )
      }
    } catch {
      if (useArtifactStore.getState().sessions[sessionId]?.lifetime !== entry.lifetime) {
        abandon()
        return
      }
      for (const ref of batch)
        updateFile(ref.artifactFileId, (file) =>
          file.version !== versions.get(ref.artifactFileId)
            ? file
            : {
                ...file,
                checking: false,
                availability: { state: 'unavailable', reason: 'io-error' }
              }
        )
    }
  }
}

export type ArtifactOperation = 'save' | 'reveal' | 'trash'
export type ArtifactOperationResult =
  ArtifactSaveResult | ArtifactActionResult | ArtifactTrashResult
export async function runArtifactAction(
  sessionId: string,
  refs: readonly ArtifactRef[],
  operation: ArtifactOperation
): Promise<ArtifactOperationResult> {
  const selected = [...new Map(refs.map((ref) => [ref.publicationId, ref])).values()]
  if (operation === 'save' && selected.length > 50)
    return { outcome: 'failed', items: [], reason: 'too-many-items' }
  const entry = useArtifactStore.getState().sessions[sessionId]
  if (
    !entry ||
    !selected.length ||
    selected.some((ref) => !entry.refs[ref.publicationId] || entry.files[ref.artifactFileId]?.busy)
  )
    return { ok: false, reason: 'busy' }
  const version = ++sequence
  for (const ref of selected)
    updateFile(ref.artifactFileId, (file) => ({ ...file, version, busy: true, checking: false }))
  try {
    const request = { sessionId, publicationId: selected[0].publicationId }
    const result =
      operation === 'save'
        ? await artifactApi.save({
            sessionId,
            publicationIds: selected.map((ref) => ref.publicationId)
          })
        : operation === 'reveal'
          ? await artifactApi.reveal(request)
          : await artifactApi.trash(request)
    if (
      'outcome' in result &&
      (result.outcome === 'trashed' || result.outcome === 'already-missing')
    ) {
      for (const ref of selected)
        updateFile(ref.artifactFileId, (file) =>
          file.version !== version
            ? file
            : {
                ...file,
                availability: { state: 'missing' },
                ...(result.outcome === 'trashed' ? { lastTrashedAt: Date.now() } : {})
              }
        )
    }
    return result
  } catch {
    return { ok: false, reason: 'io-error' }
  } finally {
    for (const ref of selected)
      updateFile(ref.artifactFileId, (file) =>
        file.version !== version ? file : { ...file, busy: false }
      )
    if (useArtifactStore.getState().sessions[sessionId]?.lifetime === entry.lifetime)
      await refreshArtifactStatuses(sessionId, selected)
  }
}
