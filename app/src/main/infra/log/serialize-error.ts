// 파일 로그용 Error 직렬화 — stack·code·cause 체인을 보존한다 (0123 AC6).
// IPC 용 평탄화는 infra/errors.ts 의 sanitizeCause(stack 미보존, structuredClone 안전) —
// 용도가 다르므로 병존한다. electron 비의존 순수 함수 → vitest 대상.

import type { SerializedError } from '../../../shared/logging'

const MAX_CAUSE_DEPTH = 3

export function serializeError(error: unknown, depth = 0): SerializedError {
  if (depth > MAX_CAUSE_DEPTH) {
    return { name: 'Error', message: '[cause depth exceeded]' }
  }
  if (error instanceof Error) {
    const coded = error as Error & { code?: unknown; cause?: unknown }
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
      code: typeof coded.code === 'string' ? coded.code : undefined,
      cause: coded.cause !== undefined ? serializeError(coded.cause, depth + 1) : undefined
    }
  }
  return { name: 'UnknownError', message: safeStringify(error) }
}

function safeStringify(value: unknown): string {
  if (typeof value === 'string') return value
  try {
    return JSON.stringify(value) ?? String(value)
  } catch {
    return String(value)
  }
}
