import type {
  ArtifactActionResult,
  ArtifactSaveResult,
  ArtifactTrashResult
} from '../../../../../shared/artifacts'

interface ArtifactOperationIssue {
  publicationId?: string
  reason?: string
  unrecorded?: boolean
}

// Cards stay quiet on successful/cancelled actions, while partial failures retain file identity.
export function artifactOperationIssues(
  result?: ArtifactActionResult | ArtifactSaveResult | ArtifactTrashResult
): ArtifactOperationIssue[] {
  if (!result) return []
  if ('items' in result) {
    const issues = result.items
      .filter((item) => item.outcome === 'failed')
      .map(({ publicationId, reason }) => ({ publicationId, reason }))
    if (issues.length) return issues
    return result.outcome === 'failed' ? [{ reason: result.reason }] : []
  }
  if ('ok' in result) return result.ok ? [] : [{ reason: result.reason }]
  if (result.outcome === 'trashed') return result.deletionRecorded ? [] : [{ unrecorded: true }]
  return [{ reason: result.outcome === 'already-missing' ? 'missing' : result.reason }]
}
