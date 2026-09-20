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
