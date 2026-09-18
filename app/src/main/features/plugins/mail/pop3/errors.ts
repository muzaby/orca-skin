export type Pop3ErrorCode =
  | 'auth_failed'
  | 'connection_failed'
  | 'tls_failed'
  | 'timeout'
  | 'parse_failed'
  | 'db_failed'
  | 'cancelled'
  | 'protocol_failed'

export class Pop3Error extends Error {
  readonly code: Pop3ErrorCode
  readonly authFailure: boolean

  constructor(code: Pop3ErrorCode, message = code, authFailure = code === 'auth_failed') {
    super(message)
    this.name = 'Pop3Error'
    this.code = code
    this.authFailure = authFailure
  }
}

export function normalizePop3Error(error: unknown): Pop3Error {
  if (error instanceof Pop3Error) return error
  const message = error instanceof Error ? error.message : String(error)
  const lower = message.toLowerCase()
  if (lower.includes('pass') && lower.includes('err')) return new Pop3Error('auth_failed')
  if (lower.includes('timeout') || lower.includes('timed out')) return new Pop3Error('timeout')
  if (lower.includes('tls') || lower.includes('certificate')) return new Pop3Error('tls_failed')
  if (lower.includes('parse') || lower.includes('mime')) return new Pop3Error('parse_failed')
  if (lower.includes('sqlite') || lower.includes('database') || lower.includes('constraint')) {
    return new Pop3Error('db_failed')
  }
  if (lower.includes('econn') || lower.includes('socket') || lower.includes('connect')) {
    return new Pop3Error('connection_failed')
  }
  return new Pop3Error('protocol_failed')
}

export function publicMailError(error: unknown): {
  code: Pop3ErrorCode
  message: string
  authFailure: boolean
} {
  const normalized = normalizePop3Error(error)
  const messages: Record<Pop3ErrorCode, string> = {
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
