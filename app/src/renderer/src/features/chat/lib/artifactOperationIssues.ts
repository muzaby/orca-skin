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
    // 0242 ΔV3 (D-013) — 대상 파일이 사라져 건너뛴 항목도 사용자가 요청한 저장의 실패다.
    const issues = result.items
      .filter((item) => item.outcome === 'failed' || item.outcome === 'skipped')
      .map(({ publicationId, outcome, reason }) => ({
        publicationId,
        reason: reason ?? (outcome === 'skipped' ? 'missing' : undefined)
      }))
    if (issues.length) return issues
    return result.outcome === 'failed' ? [{ reason: result.reason }] : []
  }
  if ('ok' in result) return result.ok ? [] : [{ reason: result.reason }]
  if (result.outcome === 'trashed') return result.deletionRecorded ? [] : [{ unrecorded: true }]
  return [{ reason: result.outcome === 'already-missing' ? 'missing' : result.reason }]
}
