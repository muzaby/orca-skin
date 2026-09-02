import type { GitDiffFileContent } from '../../../../../../shared/ipc'
import { buildDiffLines, type DiffLine } from '../../lib/diffLines'
import type { DiffPeekBodyRequest, DiffPeekBodyState } from './diffFileCache'

export interface DiffPeekBodyBridge {
  setBody: (body: DiffPeekBodyState) => void
  setDiffRequirementBodyRequest: (
    sessionKey: string,
    sessionId: string | null,
    path: string,
    request: DiffPeekBodyRequest
  ) => void
  reanchorDiffRequirements: (
    sessionKey: string,
    sessionId: string | null,
    path: string,
    request: DiffPeekBodyRequest,
    lines: readonly DiffLine[]
  ) => void
}

export function registerDiffPeekBodyRequest({
  bridge,
  sessionKey,
  sessionId,
  path,
  request
}: {
  bridge: DiffPeekBodyBridge
  sessionKey: string
  sessionId: string | null
  path: string
  request: DiffPeekBodyRequest
}): void {
  bridge.setDiffRequirementBodyRequest(sessionKey, sessionId, path, request)
}

export function handleDiffPeekBodyResult({
  bridge,
  sessionKey,
  sessionId,
  path,
  request,
  content
}: {
  bridge: DiffPeekBodyBridge
  sessionKey: string
  sessionId: string | null
  path: string
  request: DiffPeekBodyRequest
  content: GitDiffFileContent
}): void {
  bridge.setBody({ ...request, content })
  if (content.kind !== 'text') return
  bridge.reanchorDiffRequirements(
    sessionKey,
    sessionId,
    path,
    request,
    buildDiffLines(content.oldValue, content.newValue)
  )
}
