// 메일 오류 taxonomy — **프로토콜 무관 층** (0237 ΔV3 — D-057).
//
// 구 `pop3/errors.ts` 는 `timeout`·`cancelled`·`db_failed` 같은 **프로토콜과 무관한 사유**까지
// `Pop3Error` 로 날랐다. 두 번째 프로토콜이 오면 오류 타입이 둘이 되거나 이름이 거짓말이 된다.
// 프로토콜별 응답 문자열 해석(`-ERR` 판정 등)만 각 프로토콜 모듈에 남는다.

export type MailErrorCode =
  | 'auth_failed'
  | 'connection_failed'
  | 'tls_failed'
  | 'timeout'
  | 'parse_failed'
  | 'db_failed'
  | 'cancelled'
  | 'protocol_failed'

export class MailError extends Error {
  readonly code: MailErrorCode
  readonly authFailure: boolean

  constructor(code: MailErrorCode, message: string = code, authFailure = code === 'auth_failed') {
    super(message)
    this.name = 'MailError'
    this.code = code
    this.authFailure = authFailure
  }
}

export function normalizeMailError(error: unknown): MailError {
  if (error instanceof MailError) return error
  const message = error instanceof Error ? error.message : String(error)
  const lower = message.toLowerCase()
  if (lower.includes('pass') && lower.includes('err')) return new MailError('auth_failed')
  if (lower.includes('timeout') || lower.includes('timed out')) return new MailError('timeout')
  if (lower.includes('tls') || lower.includes('certificate')) return new MailError('tls_failed')
  if (lower.includes('parse') || lower.includes('mime')) return new MailError('parse_failed')
  if (lower.includes('sqlite') || lower.includes('database') || lower.includes('constraint')) {
    return new MailError('db_failed')
  }
  if (lower.includes('econn') || lower.includes('socket') || lower.includes('connect')) {
    return new MailError('connection_failed')
  }
  return new MailError('protocol_failed')
}

export function publicMailError(error: unknown): {
  code: MailErrorCode
  message: string
  authFailure: boolean
} {
  const normalized = normalizeMailError(error)
  const messages: Record<MailErrorCode, string> = {
    auth_failed: '메일 서버가 자격증명을 거부했습니다.',
    connection_failed: '메일 서버에 연결할 수 없습니다.',
    tls_failed: '메일 서버의 TLS 연결을 확인할 수 없습니다.',
    timeout: '메일 서버 응답 시간이 초과되었습니다.',
    parse_failed: '메일 내용을 해석할 수 없습니다.',
    db_failed: '메일 캐시를 저장할 수 없습니다.',
    cancelled: '메일 동기화가 취소되었습니다.',
    protocol_failed: '메일 서버 응답을 이해할 수 없습니다.'
  }
  return {
    code: normalized.code,
    message: messages[normalized.code],
    authFailure: normalized.authFailure
  }
}
