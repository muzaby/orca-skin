import { createStore, type StoreApi } from 'zustand/vanilla'
import { mailArchiveApi } from '../../shared/api/ipc'
import { mailArchiveErrorKey } from './errors'
import type {
  MailArchiveImportResult,
  MailArchiveProgress,
  MailArchiveSource,
  MailArchiveSourceRemovalResult,
  MailArchiveStats
} from '../../../../shared/mail-archive'

export type MailArchiveSourceApi = Pick<
  typeof mailArchiveApi,
  'stats' | 'sources' | 'onProgress' | 'pickFiles' | 'import' | 'cancel' | 'removeSource'
>

export interface MailArchiveSourceState {
  sources: readonly MailArchiveSource[]
  stats: MailArchiveStats | null
  progress: MailArchiveProgress | null
  lastImport: MailArchiveImportResult | null
  lastRemoval: MailArchiveSourceRemovalResult | null
  errorKey: ReturnType<typeof mailArchiveErrorKey> | null
  loading: boolean
  importing: boolean
  removingSourceId: string | null
  revision: number
  acquire(): () => void
  refresh(changed?: boolean): Promise<void>
  add(): Promise<void>
  cancel(): Promise<void>
  remove(id: string): Promise<void>
}

/** One source snapshot per renderer, shared by settings and the archive page. */
export type MailArchiveSourceStore = StoreApi<MailArchiveSourceState>

export function createMailArchiveSourceStore(api: MailArchiveSourceApi): MailArchiveSourceStore {
  let readers = 0
  let refreshGeneration = 0
  let progressGeneration = 0
  let subscriptionGeneration = 0
  let unsubscribe: (() => void) | undefined
  return createStore<MailArchiveSourceState>((set, get) => ({
    sources: [],
    stats: null,
    progress: null,
    lastImport: null,
    lastRemoval: null,
    errorKey: null,
    loading: false,
    importing: false,
    removingSourceId: null,
    revision: 0,
    acquire: () => {
      if (readers++ === 0) {
        const subscription = ++subscriptionGeneration
        unsubscribe = api.onProgress((progress) => {
          if (subscription !== subscriptionGeneration) return
          progressGeneration++
          set({ progress })
          if (progress.state !== 'running') void get().refresh(true)
        })
        void get().refresh()
      }
      let released = false
      return () => {
        if (released) return
        released = true
        if (--readers === 0) {
          subscriptionGeneration++
          refreshGeneration++
          unsubscribe?.()
          unsubscribe = undefined
          set({ loading: false })
        }
      }
    },
    refresh: async (changed = false) => {
      const generation = ++refreshGeneration
      const progressVersion = progressGeneration
      set({ loading: true })
      try {
        const [stats, sources] = await Promise.all([api.stats(), api.sources()])
        if (generation !== refreshGeneration) return
        set((state) => ({
          stats,
          sources,
          loading: false,
          ...(!changed ? { errorKey: null } : {}),
          ...(progressVersion === progressGeneration
            ? { progress: stats.progress ?? null, lastImport: stats.lastImport ?? state.lastImport }
            : {}),
          revision: state.revision + (changed ? 1 : 0)
        }))
      } catch (error) {
        if (generation === refreshGeneration)
          set({ loading: false, errorKey: mailArchiveErrorKey(error) })
      }
    },
    add: async () => {
      if (get().importing || get().progress?.state === 'running' || get().removingSourceId) return
      refreshGeneration++
      set({ importing: true, loading: false, errorKey: null, lastRemoval: null })
      try {
        const selected = await api.pickFiles()
        if (!selected) {
          await get().refresh()
          return
        }
        const result = await api.import(selected)
        progressGeneration++
        set({ lastImport: result, progress: null })
        await get().refresh(true)
      } catch (error) {
        set({ errorKey: mailArchiveErrorKey(error) })
        await get().refresh(true)
      } finally {
        set({ importing: false })
      }
    },
    cancel: async () => {
      const progress = get().progress
      if (!progress?.cancellable || progress.state !== 'running') return
      try {
        await api.cancel(progress.jobId)
      } catch (error) {
        set({ errorKey: mailArchiveErrorKey(error) })
      }
    },
    remove: async (id) => {
      if (get().removingSourceId) return
      refreshGeneration++
      set({ removingSourceId: id, loading: false, errorKey: null, lastRemoval: null })
      try {
        const result = await api.removeSource(id)
        if (result.state === 'cancelled') {
          await get().refresh()
          return
        }
        set({ lastRemoval: result })
        await get().refresh(true)
      } catch (error) {
        set({ errorKey: mailArchiveErrorKey(error) })
        await get().refresh(true)
      } finally {
        set({ removingSourceId: null })
      }
    }
  }))
}

export const mailArchiveSourceStore = createMailArchiveSourceStore(mailArchiveApi)
