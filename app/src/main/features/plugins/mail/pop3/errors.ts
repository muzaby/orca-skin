import { normalizePop3Error, type Pop3ErrorCode } from '../../../../infra/net/pop3-errors'
export {
  Pop3Error,
  normalizePop3Error,
  type Pop3ErrorCode
} from '../../../../infra/net/pop3-errors'

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
