import type { AppErrorTitle } from '../../../../../shared/app-error'
import { i18n, type MessageKey } from '../../../shared/i18n'
import { reportError } from '../../../shared/errors'
import { artifactFailureKey } from './artifactFeedback'

// 0242 ΔV2 (D-011) — 파일 가용성은 카드에 미리 표시하지 않는다. 사용자가 동작을 요청했을 때
// 실패 사유를 toast 로 알린다. 카드·뷰어·작업 컨텍스트가 이 함수 하나로 제목·설명을 만든다.
const FILE_UNAVAILABLE_REASONS = new Set([
  'missing',
  'not-found',
  'access-denied',
  'forbidden',
  'unsafe-path',
  'io-error'
])

export function artifactIssueTitle(reason?: string): AppErrorTitle {
  return reason !== undefined && FILE_UNAVAILABLE_REASONS.has(reason)
    ? 'fileUnavailable'
    : 'actionFailed'
}

export function reportArtifactIssue(input: {
  event: string
  filename?: string
  reason?: string
  /** 사유 문구를 직접 지정할 때(미리보기 형식 오류·기록 실패 등). 없으면 reason 으로 해석한다. */
  messageKey?: MessageKey
  error?: unknown
}): void {
  const text = i18n.t(input.messageKey ?? artifactFailureKey(input.reason))
  reportError({
    event: input.event,
    scope: 'artifacts',
    title: artifactIssueTitle(input.reason),
    error: input.error,
    detail: input.filename ? `${input.filename}: ${text}` : text,
    data: input.reason === undefined ? undefined : { reason: input.reason }
  })
}
