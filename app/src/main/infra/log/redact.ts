// 중앙 Redaction — 파일 기록 직전 모든 레코드가 통과한다 (0123 AC5).
// 비밀은 로그에 절대 노출 금지·마스킹 의무 (docs/arch/backend/security.md §1.4).
// key 기반(민감 키 이름) + 값 패턴(형태로 식별되는 비밀) 이중 방어. 문자열은 8KB 로 절단.
// electron 비의존 순수 함수 → vitest 대상.

import { LOG_STRING_MAX_LENGTH, type LogRecord } from '../../../shared/logging'

export const REDACTED = '[REDACTED]'

// 부분 문자열 매칭(소문자) — 'authToken'·'apiKeyId'·'set-cookie' 류를 한 번에 잡는다.
// 'pat' 은 'path' 오탐이 있어 부분 매칭에 넣지 않고 정확 일치로만 본다.
const SENSITIVE_KEY_FRAGMENTS = [
  'authorization',
  'cookie',
  'password',
  'passwd',
  'secret',
  'token',
  'apikey',
  'api_key',
  'api-key',
  'credential',
  'privatekey',
  'private_key',
  'private-key'
]
const SENSITIVE_KEY_EXACT = new Set(['pat', 'auth', 'bearer', 'key'])

// 값 형태 기반 탐지 — key 이름이 무해해도 값이 비밀 형태면 마스킹한다.
const SENSITIVE_VALUE_PATTERNS: RegExp[] = [
  /\bBearer\s+[A-Za-z0-9\-._~+/]{8,}=*/g, // Authorization: Bearer <token>
  /\bBasic\s+[A-Za-z0-9+/]{8,}=*/g, // Authorization: Basic <credential>
  /\beyJ[A-Za-z0-9_-]{6,}\.[A-Za-z0-9_-]{6,}\.[A-Za-z0-9_-]{6,}\b/g, // JWT
  /-----BEGIN[A-Z ]*PRIVATE KEY-----[\s\S]*?(?:-----END[A-Z ]*PRIVATE KEY-----|$)/g, // PEM
  /\bAKIA[0-9A-Z]{16}\b/g, // AWS access key id
  /\bsk-[A-Za-z0-9_-]{16,}\b/g, // OpenAI/Anthropic 류 secret key
  /\bgh[pousr]_[A-Za-z0-9]{20,}\b/g, // GitHub PAT
  /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/g // Slack token
]

const MAX_DEPTH = 8

export function isSensitiveKey(key: string): boolean {
  const lower = key.toLowerCase()
  if (SENSITIVE_KEY_EXACT.has(lower)) return true
  return SENSITIVE_KEY_FRAGMENTS.some((fragment) => lower.includes(fragment))
}

export function redactString(value: string): string {
  let out = value.length > LOG_STRING_MAX_LENGTH ? value.slice(0, LOG_STRING_MAX_LENGTH) : value
  for (const pattern of SENSITIVE_VALUE_PATTERNS) {
    out = out.replace(pattern, REDACTED)
  }
  return out
}

function redactValue(value: unknown, depth: number): unknown {
  if (depth > MAX_DEPTH) return '[depth exceeded]'
  if (typeof value === 'string') return redactString(value)
  if (Array.isArray(value)) return value.map((item) => redactValue(item, depth + 1))
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [key, inner] of Object.entries(value)) {
      out[key] = isSensitiveKey(key) ? REDACTED : redactValue(inner, depth + 1)
    }
    return out
  }
  return value
}

// LogRecord 전체를 마스킹한 사본으로 만든다. message·data·error(message/stack/cause) 가 대상.
// event/scope 는 고정 이벤트명 규칙이라 값 패턴 검사 대상이 아니다(스키마가 형식을 강제).
export function redactRecord(record: LogRecord): LogRecord {
  return {
    ...record,
    message: record.message === undefined ? undefined : redactString(record.message),
    data:
      record.data === undefined ? undefined : (redactValue(record.data, 1) as LogRecord['data']),
    error:
      record.error === undefined ? undefined : (redactValue(record.error, 1) as LogRecord['error'])
  }
}
