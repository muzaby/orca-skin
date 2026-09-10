import type { ArtifactActionResult, ArtifactCatalogItem } from '../../../shared/artifacts'
import type { ArtifactQueries } from '../../infra/db/artifact-queries'

export class ArtifactCatalog {
  constructor(private readonly queries: Pick<ArtifactQueries, 'listCatalog' | 'setPinned'>) {}

  list(): ArtifactCatalogItem[] {
    return this.queries.listCatalog()
  }

  setPinned(sessionId: string, publicationId: string, pinned: boolean): ArtifactActionResult {
    return this.queries.setPinned(sessionId, publicationId, pinned)
      ? { ok: true }
      : { ok: false, reason: 'forbidden' }
  }
}
