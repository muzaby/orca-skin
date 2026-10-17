import type { ClassifiedError } from '../../../../shared/ipc'
import { isRecord } from '../../../../shared/obj'
import { makeClassifiedError } from '../../../infra/errors'

/** Decode 1.x errors without forwarding provider bodies, headers or credentials to history. */
export function classifyOpenCodeError(
  error: unknown,
  fallback: 'stream_error' | 'provider_connection_error' = 'stream_error'
): ClassifiedError {
  const cause = error instanceof Error && isRecord(error.cause) ? error.cause : undefined
  const native = cause?.body ?? cause ?? error
  const record = isRecord(native) ? native : {}
  const data = isRecord(record.data) ? record.data : {}
  const status = data.statusCode ?? cause?.status
  const message = typeof data.message === 'string' ? data.message : ''
  const result = (category: ClassifiedError['category'], text: string): ClassifiedError =>
    makeClassifiedError(category, text, { provider: 'opencode', retryable: false })

  if (status === 403 && isRestrictedFreeTier(data.responseBody, message)) {
    return result(
      'permission_denied',
      'OpenCode 무료 모델은 공급자 정책상 OpenCode 앱에서만 사용할 수 있어 Orca의 요청이 거절되었습니다(403). 엔진 및 모델에서 외부 앱 사용이 허용된 공급자를 설정한 뒤 모델을 선택해 주세요.'
    )
  }
  if (record.name === 'ProviderAuthError' || status === 401) {
    return result(
      'auth_error',
      'OpenCode 모델 인증에 실패했습니다. 엔진 및 모델에서 공급자의 API 키와 인증 설정을 확인해 주세요.'
    )
  }
  if (status === 403) {
    return result(
      'permission_denied',
      'OpenCode 모델 공급자가 요청을 거절했습니다(403). 공급자의 모델 사용 권한과 계정 정책을 확인해 주세요.'
    )
  }
  if (status === 429) {
    return result(
      'provider_connection_error',
      'OpenCode 모델 공급자의 요청 한도에 도달했습니다(429). 사용량과 잔액을 확인한 뒤 다시 시도해 주세요.'
    )
  }
  if (record.name === 'ContextOverflowError') {
    return result(
      'stream_error',
      'OpenCode 모델의 컨텍스트 한도를 초과했습니다. 새 대화에서 다시 시도해 주세요.'
    )
  }
  // Locally generated startup/transport errors already carry an actionable message.
  // SDK HTTP errors have a cause; never expose their raw Error.message.
  if (fallback === 'provider_connection_error' && error instanceof Error && !cause) {
    return result(fallback, error.message)
  }
  return result(
    fallback,
    'OpenCode 응답이 실패했습니다. 모델 공급자와 서버 연결 상태를 확인한 뒤 다시 시도해 주세요.'
  )
}

function isRestrictedFreeTier(body: unknown, message: string): boolean {
  if (/free tier can only be used from within OpenCode/i.test(message)) return true
  if (typeof body !== 'string') return false
  try {
    const parsed: unknown = JSON.parse(body)
    return (
      isRecord(parsed) &&
      isRecord(parsed.error) &&
      parsed.error.type === 'FreeTierError' &&
      typeof parsed.error.message === 'string' &&
      /free tier can only be used from within OpenCode/i.test(parsed.error.message)
    )
  } catch {
    return false
  }
}
