import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import type { ArtifactCatalogItem } from '../../../../../shared/artifacts'

const state = vi.hoisted(() => ({ items: [] as ArtifactCatalogItem[], loading: false }))
vi.mock('../store/artifactCatalogStore', async (original) => ({
  ...(await original<typeof import('../store/artifactCatalogStore')>()),
  useArtifactCatalogStore: () => ({ ...state, busy: {}, error: null })
}))
import { ArtifactsView } from './ArtifactsView'

const item: ArtifactCatalogItem = {
  artifactFileId: 'f',
  publicationId: 'p',
  sessionId: 's',
  sessionTitle: 'Session',
  title: 'Report',
  filename: 'report.md',
  kind: 'markdown',
  sizeBytes: 9,
  publishedAt: 1,
  pinned: false
}
const render = (): string =>
  renderToStaticMarkup(createElement(ArtifactsView, { onOpen: vi.fn(), onDeleted: vi.fn() }))
const count = (): string | undefined =>
  render().match(/data-artifact-catalog-count=""[^>]*>([^<]+)</)?.[1]

describe('catalog title total', () => {
  it('tracks loaded, newly published, deleted and empty totals beside the title', () => {
    state.items = [item]
    expect(count()).toBe('1개')
    state.items = [item, { ...item, artifactFileId: 'f2', publicationId: 'p2' }]
    expect(count()).toBe('2개')
    state.items = [item]
    expect(count()).toBe('1개')
    state.items = []
    expect(count()).toBe('0개')
  })
  it('keeps the current total while refreshing the existing list', () => {
    state.items = [item]
    state.loading = true
    expect(count()).toBe('1개')
    state.loading = false
  })
})
