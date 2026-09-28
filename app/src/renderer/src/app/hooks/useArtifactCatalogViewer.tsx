import { useCallback, useEffect, useLayoutEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import type { ArtifactCatalogItem } from '../../../../shared/artifacts'
import type { ArtifactsViewProps } from '../../features/artifacts'
import {
  ArtifactViewer,
  closeArtifactViewer,
  openArtifactViewer,
  setArtifactViewerWidth,
  useArtifactViewerStore
} from '../../features/chat'

const CATALOG_KEY = 'artifact-catalog:'

// The app owns the catalog → chat viewer composition. Catalog rows never depend on chat state.
export function useArtifactCatalogViewer(): ArtifactsViewProps {
  const { pathname } = useLocation()
  const selection = useArtifactViewerStore((state) => state.selection)
  const width = useArtifactViewerStore((state) => state.widths.catalog)
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
      // 결과를 기다리는 카탈로그 열기(0242 ΔV4)도 함께 취소한다.
      const { selection: current, opening } = useArtifactViewerStore.getState()
      for (const key of new Set([current?.sessionKey, opening?.sessionKey]))
        if (key?.startsWith(CATALOG_KEY)) closeArtifactViewer(key)
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
    viewerWidth: width,
    viewerKey: viewer ? `${viewer.sessionKey}:${viewer.request}` : undefined,
    onViewerWidthChange: (next) => setArtifactViewerWidth('catalog', next),
    viewer: viewer ? (
      <ArtifactViewer key={`${viewer.sessionKey}:${viewer.request}`} selection={viewer} />
    ) : undefined
  }
}
