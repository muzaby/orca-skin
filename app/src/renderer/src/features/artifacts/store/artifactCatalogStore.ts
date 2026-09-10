import { create } from 'zustand'
import type { ArtifactCatalogItem } from '../../../../../shared/artifacts'
import { artifactApi } from '../../../shared/api/ipc'

export type ArtifactCatalogTab = 'all' | 'pinned'
interface ArtifactCatalogState {
  items: ArtifactCatalogItem[]
  loading: boolean
  error: 'load' | 'pin' | 'trash' | null
  busy: Record<string, true>
}
export const useArtifactCatalogStore = create<ArtifactCatalogState>(() => ({
  items: [],
  loading: false,
  error: null,
  busy: {}
}))
let revision = 0

export function filterArtifactCatalog(
  items: readonly ArtifactCatalogItem[],
  tab: ArtifactCatalogTab,
  query: string
): ArtifactCatalogItem[] {
  const terms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean)
  return items.filter((item) => {
    if (tab === 'pinned' && !item.pinned) return false
    const text = `${item.title} ${item.filename} ${item.sessionTitle}`.toLocaleLowerCase()
    return terms.every((term) => text.includes(term))
  })
}

export async function refreshArtifactCatalog(): Promise<void> {
  const request = ++revision
  useArtifactCatalogStore.setState({ loading: true, error: null })
  try {
    const items = await artifactApi.catalog()
    if (request === revision) useArtifactCatalogStore.setState({ items, loading: false })
  } catch {
    if (request === revision) useArtifactCatalogStore.setState({ loading: false, error: 'load' })
  }
}

async function mutate(
  item: ArtifactCatalogItem,
  kind: 'pin' | 'trash',
  action: () => Promise<boolean>,
  update: (items: ArtifactCatalogItem[]) => ArtifactCatalogItem[]
): Promise<boolean> {
  const fileId = item.artifactFileId
  if (useArtifactCatalogStore.getState().busy[fileId]) return false
  useArtifactCatalogStore.setState((state) => ({
    busy: { ...state.busy, [fileId]: true },
    error: null
  }))
  try {
    if (!(await action())) {
      useArtifactCatalogStore.setState({ error: kind })
      return false
    }
    // A catalog response captured before this write must not undo its persisted result.
    revision++
    useArtifactCatalogStore.setState((state) => ({ items: update(state.items), loading: false }))
    return true
  } catch {
    useArtifactCatalogStore.setState({ error: kind })
    return false
  } finally {
    useArtifactCatalogStore.setState((state) => {
      const busy = { ...state.busy }
      delete busy[fileId]
      return { busy }
    })
  }
}

export function setCatalogArtifactPinned(
  item: ArtifactCatalogItem,
  pinned: boolean
): Promise<boolean> {
  return mutate(
    item,
    'pin',
    async () =>
      (
        await artifactApi.setPinned({
          sessionId: item.sessionId,
          publicationId: item.publicationId,
          pinned
        })
      ).ok,
    (items) =>
      items.map((entry) =>
        entry.artifactFileId === item.artifactFileId ? { ...entry, pinned } : entry
      )
  )
}

export function trashCatalogArtifact(item: ArtifactCatalogItem): Promise<boolean> {
  return mutate(
    item,
    'trash',
    async () => {
      const result = await artifactApi.trash({
        sessionId: item.sessionId,
        publicationId: item.publicationId
      })
      return result.outcome === 'trashed' || result.outcome === 'already-missing'
    },
    (items) => items.filter((entry) => entry.artifactFileId !== item.artifactFileId)
  )
}
