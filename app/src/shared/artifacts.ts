// 게시 메타데이터 계약. 본문과 내부 파일 경로는 renderer에 전달하지 않는다.
export interface ArtifactRef {
  publicationId: string
  artifactFileId: string
  title: string
  filename: string
  kind: 'html' | 'markdown'
  sizeBytes: number
  publishedAt: number
}

export type ArtifactAvailability =
  | { state: 'present'; sizeBytes: number; modifiedAt: number }
  | { state: 'missing' }
  | { state: 'unavailable'; reason: 'access-denied' | 'io-error' | 'unsafe-path' }

export interface ArtifactStatusItem {
  publicationId: string
  artifactFileId: string
  availability: ArtifactAvailability
  lastTrashedAt?: number
}

export interface ArtifactListRequest {
  sessionId: string
}
export interface ArtifactTargetRequest extends ArtifactListRequest {
  publicationId: string
}
export interface ArtifactStatusRequest extends ArtifactListRequest {
  publicationIds: string[]
}
export type ArtifactSaveRequest = ArtifactStatusRequest
export type ArtifactTrashRequest = ArtifactTargetRequest

export type ArtifactTrashResult =
  | { outcome: 'trashed'; deletionRecorded: boolean }
  | { outcome: 'already-missing' }
  | { outcome: 'failed'; reason: 'forbidden' | 'unsafe-path' | 'trash-failed' }

export interface ArtifactActionResult {
  ok: boolean
  reason?: string
}
export interface ArtifactSaveItem {
  publicationId: string
  outcome: 'saved' | 'skipped' | 'failed'
  reason?: string
}
export interface ArtifactSaveResult {
  outcome: 'completed' | 'cancelled' | 'failed'
  items: ArtifactSaveItem[]
  reason?: string
}
