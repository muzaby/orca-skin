// claude 특화 ErrorClassifier (provider-runtime.md §6). SDK 비의존 — 예외의 메시지/이름
// 문자열 패턴만 보고 8 category 중 claude 가 실제 생성하는 부분집합으로 분류한다.
//   - 인증(401/unauthorized/OAuth/expired)        → auth_error          (재로그인 모달 분기)
//   - 바이너리/spawn 부재(ENOENT/spawn/not found)  → provider_connection_error
//   - 취소(abort/cancelled/AbortError)            → user_cancelled       (정상 종료 — emit 안 함, 분류만)
//   - 그 외 (스트림/iterator 오류 일반)             → stream_error
// 나머지 category(permission_denied·tool_execution_error·capability_unsupported·
// schema_validation_error)는 claude 어댑터 경로에서 직접 발생하지 않아 seam(IPC/OpenCode 가 생성).
// 순수 함수 → vitest 대상.

import type { ClassifiedError, NormalizedEvent } from '../../shared/ipc'
import { makeClassifiedError, type ErrorClassifier } from './classifier'

const AUTH_PATTERNS = [/\b401\b/, /\bunauthori[sz]ed\b/i, /\bOAuth\b/i, /\bexpired\b/i]
// 자식 프로세스(claude 바이너리) spawn 실패 — 연결 불가로 취급(재시도 가치 있음).
const CONNECTION_PATTERNS = [/\bENOENT\b/, /\bspawn\b/i, /\bnot[ -]found\b/i]
// 의도적 중단. AbortController.abort() 는 'AbortError'/'aborted' 메시지를 남긴다. 어댑터가
// signal.aborted 가드로 emit 자체를 막지만(설계 결정 3), 분류 자체는 user_cancelled 로 고정한다.
const CANCEL_PATTERNS = [/\bAbortError\b/, /\baborted\b/i, /\bcancell?ed\b/i]

// 인증 만료는 원문 대신 사용자용 안내 문구로 치환(재로그인 모달이 띄울 메시지). 그 외는 원문 보존.
const AUTH_MESSAGE = 'Claude Code 인증이 만료되었습니다.'

export const claudeErrorClassifier: ErrorClassifier = {
  classify(error, ctx): ClassifiedError {
    const message = error instanceof Error ? error.message : String(error)
    const name = error instanceof Error ? error.name : ''
    const haystack = `${name} ${message}`

    if (CANCEL_PATTERNS.some((re) => re.test(haystack))) {
      return makeClassifiedError('user_cancelled', message, {
        provider: ctx.provider,
        cause: error
      })
    }
    if (AUTH_PATTERNS.some((re) => re.test(message))) {
      return makeClassifiedError('auth_error', AUTH_MESSAGE, {
        provider: ctx.provider,
        cause: error
      })
    }
    if (CONNECTION_PATTERNS.some((re) => re.test(haystack))) {
      return makeClassifiedError('provider_connection_error', message, {
        provider: ctx.provider,
        cause: error
      })
    }
    return makeClassifiedError('stream_error', message, { provider: ctx.provider, cause: error })
  }
}

// ClassifiedError → error NormalizedEvent 봉투. sessionId 가 미상('')이면 생략(envelope optional).
// 코어 중립(0016): 이벤트는 provider 를 싣지 않는다 — provider 식별은 ClassifiedError.provider(표시용).
export function errorEvent(
  error: ClassifiedError,
  sessionId: string
): Extract<NormalizedEvent, { type: 'error' }> {
  return {
    type: 'error',
    ...(sessionId !== '' ? { sessionId } : {}),
    error
  }
}
