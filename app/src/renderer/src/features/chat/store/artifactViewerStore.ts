import { create } from 'zustand'
import type { ArtifactRef, ArtifactPreviewResult } from '../../../../../shared/artifacts'

export interface ArtifactViewerSelection {
  sessionKey: string
  sessionId: string
  artifact: ArtifactRef
  request: number
  loading: boolean
  result?: ArtifactPreviewResult
  mode: 'preview' | 'code'
  expanded: boolean
  origin?: HTMLElement
}
export const useArtifactViewerStore = create<{ selection: ArtifactViewerSelection | null }>()(
  () => ({ selection: null })
)
let sequence = 0

async function readSelection(selection: ArtifactViewerSelection): Promise<void> {
  let result: ArtifactPreviewResult
  try {
    result = await window.orca.artifacts.preview({
      sessionId: selection.sessionId,
      publicationId: selection.artifact.publicationId
    })
  } catch {
    result = { state: 'unavailable', reason: 'io-error' }
  }
  useArtifactViewerStore.setState((state) => {
    if (state.selection?.request !== selection.request) return state
    return { selection: { ...state.selection, loading: false, result } }
  })
}

export async function openArtifactViewer(
  sessionKey: string,
  sessionId: string,
  artifact: ArtifactRef,
  origin?: HTMLElement
): Promise<void> {
  const selection: ArtifactViewerSelection = {
    sessionKey,
    sessionId,
    artifact,
    origin,
    request: ++sequence,
    loading: true,
    mode: artifact.kind === 'text' ? 'code' : 'preview',
    expanded: false
  }
  useArtifactViewerStore.setState({ selection })
  await readSelection(selection)
}

export function closeArtifactViewer(sessionKey?: string): void {
  const selected = useArtifactViewerStore.getState().selection
  if (!selected || (sessionKey !== undefined && selected.sessionKey !== sessionKey)) return
  useArtifactViewerStore.setState({ selection: null })
}

export async function retryArtifactViewer(): Promise<void> {
  const current = useArtifactViewerStore.getState().selection
  if (!current || current.loading) return
  const selection = { ...current, request: ++sequence, loading: true, result: undefined }
  useArtifactViewerStore.setState({ selection })
  await readSelection(selection)
}

export function setArtifactViewerMode(mode: ArtifactViewerSelection['mode']): void {
  useArtifactViewerStore.setState((state) =>
    state.selection ? { selection: { ...state.selection, mode } } : state
  )
}

export function toggleArtifactViewerExpanded(): void {
  useArtifactViewerStore.setState((state) =>
    state.selection
      ? { selection: { ...state.selection, expanded: !state.selection.expanded } }
      : state
  )
}
