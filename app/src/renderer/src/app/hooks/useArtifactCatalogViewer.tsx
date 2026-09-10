import { useCallback, useEffect, useLayoutEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import type { ArtifactCatalogItem } from '../../../../shared/artifacts'
import type { ArtifactsViewProps } from '../../features/artifacts'
import {
  ArtifactViewer,
  closeArtifactViewer,
  openArtifactViewer,
  useArtifactViewerStore
} from '../../features/chat'

const CATALOG_KEY = 'artifact-catalog:'

// The app owns the catalog → chat viewer composition. Catalog rows never depend on chat state.
export function useArtifactCatalogViewer(): ArtifactsViewProps {
  const { pathname } = useLocation()
  const selection = useArtifactViewerStore((state) => state.selection)
  const isCatalog = pathname === '/artifacts'
  const viewer = isCatalog && selection?.sessionKey.startsWith(CATALOG_KEY) ? selection : null
  const origin = useRef<HTMLElement | undefined>(undefined)
  useLayoutEffect(() => {
    if (viewer) origin.current = viewer.origin
    else if (origin.current) {
      const target = origin.current
      origin.current = undefined
      if (isCatalog && target.isConnected && !target.closest('[inert]'))
        target.focus({ preventScroll: true })
    }
  }, [viewer, isCatalog])
  useEffect(() => {
    if (!isCatalog) return
    return () => {
      origin.current = undefined
      const current = useArtifactViewerStore.getState().selection
      if (current?.sessionKey.startsWith(CATALOG_KEY)) closeArtifactViewer(current.sessionKey)
    }
  }, [isCatalog])
  const onOpen = useCallback((item: ArtifactCatalogItem, target: HTMLElement): void => {
    void openArtifactViewer(`${CATALOG_KEY}${item.sessionId}`, item.sessionId, item, target)
  }, [])
  const onDeleted = useCallback((item: ArtifactCatalogItem): void => {
    const current = useArtifactViewerStore.getState().selection
    if (
      current?.sessionKey.startsWith(CATALOG_KEY) &&
      current.artifact.artifactFileId === item.artifactFileId
    ) {
      closeArtifactViewer(current.sessionKey)
    }
  }, [])
  return {
    onOpen,
    onDeleted,
    selectedFileId: viewer?.artifact.artifactFileId,
    viewerExpanded: viewer?.expanded,
    viewer: viewer ? (
      <ArtifactViewer key={`${viewer.sessionKey}:${viewer.request}`} selection={viewer} />
    ) : undefined
  }
}
