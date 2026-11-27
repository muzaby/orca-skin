import { createElement } from 'react'
import { it, vi } from 'vitest'
import { expectVirtualKeys } from '../../../shared/ui/virtual/rowKeys.testfixture'
import { CATALOG_VIRTUALIZE_AFTER } from '../../../shared/ui/virtual/limits'

import type { ArtifactCatalogItem } from '../../../../../shared/artifacts'
import { ArtifactsView } from './ArtifactsView'

const catalog = vi.hoisted(() => ({
  items: [] as ArtifactCatalogItem[],
  loading: false,
  busy: {},
  error: null
}))
vi.mock('../store/artifactCatalogStore', async (original) => ({
  ...(await original<typeof import('../store/artifactCatalogStore')>()),
  useArtifactCatalogStore: () => catalog
}))

it('uses the artifact file ID even when artifacts share a session and publication', () => {
  catalog.items = Array.from({ length: CATALOG_VIRTUALIZE_AFTER + 1 }, (_, i) => ({
    artifactFileId: 'file-' + (100 - i),
    publicationId: 'publication',
    sessionId: 'session',
    sessionTitle: 'Session',
    title: 'Report',
    filename: 'report.md',
    kind: 'markdown',
    sizeBytes: 1,
    publishedAt: 1,
    pinned: false
  }))
  expectVirtualKeys(
    createElement(ArtifactsView, { onOpen: vi.fn(), onDeleted: vi.fn() }),
    catalog.items.map((item) => item.artifactFileId)
  )
})
